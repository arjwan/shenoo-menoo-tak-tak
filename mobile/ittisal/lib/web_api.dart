import 'dart:convert';
import 'dart:io';

/// Uses the same revocable cookie session as the original shinomino.com web app.
class Api {
  Api({Uri? baseUri}) : baseUri = baseUri ?? Uri.parse('https://shinomino.com');
  final Uri baseUri;
  Cookie? _session;
  bool get hasSession => _session != null;
  Map<String, String> get mediaHeaders => _session == null
      ? const {} : {HttpHeaders.cookieHeader: '${_session!.name}=${_session!.value}'};
  void clearSession() => _session = null;

  Uri resolve(String path) {
    final uri = baseUri.resolve(path);
    if (uri.origin != baseUri.origin || uri.userInfo.isNotEmpty) {
      throw const ApiError('عنوان الخدمة غير معتمد', 0);
    }
    return uri;
  }

  Future<Map<String, dynamic>> request(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
    final uri = resolve(path);
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    try {
      final req = await client.openUrl(method, uri).timeout(const Duration(seconds: 20));
      req.followRedirects = false;
      req.headers.contentType = ContentType.json;
      req.headers.set(HttpHeaders.acceptHeader, 'application/json');
      req.headers.set('Origin', baseUri.origin);
      if (_session != null) req.cookies.add(_session!);
      if (body != null) req.write(jsonEncode(body));
      final res = await req.close().timeout(const Duration(seconds: 25));
      final text = await utf8.decoder.bind(res).join().timeout(const Duration(seconds: 25));
      if (res.statusCode == 401 && path != '/api/auth/signin') clearSession();
      final dynamic value;
      try { value = jsonDecode(text); }
      catch (_) { throw ApiError('الخادم لم يُرجع بيانات صالحة. حاول مجدداً.', res.statusCode); }
      if (value is! Map<String, dynamic>) throw const ApiError('استجابة الخدمة غير صالحة', 0);
      if (res.statusCode < 200 || res.statusCode >= 300 || value['ok'] != true) {
        throw ApiError(value['message']?.toString() ?? 'تعذر تنفيذ الطلب', res.statusCode);
      }
      for (final cookie in res.cookies) {
        if (cookie.name != '__Host-shino_session' || (cookie.path != null && cookie.path != '/') ||
            (cookie.domain != null && cookie.domain!.isNotEmpty)) continue;
        _session = cookie.value.isEmpty || cookie.maxAge == 0 ? null : cookie;
      }
      return value;
    } on ApiError { rethrow;
    } catch (_) { throw const ApiError('تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.', 0);
    } finally { client.close(force: true); }
  }

  Future<Map<String, dynamic>> signIn(String identifier, String password) async {
    clearSession();
    await request('/api/auth/signin', method: 'POST', body: {
      'identifier': identifier.trim(), 'password': password, 'remember': false,
    });
    if (!hasSession) throw const ApiError('لم ينشئ الخادم جلسة دخول صالحة', 401);
    final verified = await request('/api/auth/session');
    if (verified['authenticated'] != true || verified['user'] is! Map) {
      clearSession();
      throw const ApiError('تعذر التحقق من جلسة الدخول', 401);
    }
    return Map<String, dynamic>.from(verified['user'] as Map);
  }

  Future<void> logout() async {
    // Keep the session if revocation fails so the user can retry safely.
    await request('/api/auth/logout', method: 'POST');
    clearSession();
  }
}

class ApiError implements Exception {
  const ApiError(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}
