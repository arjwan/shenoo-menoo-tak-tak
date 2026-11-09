import 'dart:convert';
import 'dart:io';
import 'dart:async';
import 'dart:math';
import 'dart:typed_data';

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
            (cookie.domain != null && cookie.domain!.isNotEmpty)) { continue; }
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

  Future<String> uploadMedia({required String name, required String mime, required int size,
      required Stream<List<int>> stream, String purpose = 'posts', void Function(double)? onProgress}) async {
    if (size < 1 || size > 100 * 1024 * 1024) throw const ApiError('الحد الأقصى للملف 100 ميغابايت', 413);
    final result = await request('/api/uploads', method: 'POST', body: {
      'name': name, 'mime': mime, 'size': size, 'purpose': purpose,
    });
    final id = result['uploadId'], partSize = result['partSize'];
    if (id is! String || !RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(id) || partSize is! int || partSize < 1 || partSize > 8 * 1024 * 1024) {
      throw const ApiError('تعذر تجهيز رفع الملف', 0);
    }
    final iterator = StreamIterator<List<int>>(stream);
    List<int> pending = const [];
    var offset = 0, sent = 0, part = 1;
    try {
      while (sent < size) {
        final needed = min(partSize, size - sent), builder = BytesBuilder(copy: false);
        while (builder.length < needed) {
          if (offset >= pending.length) {
            if (!await iterator.moveNext()) throw const ApiError('انقطعت قراءة الملف قبل اكتماله', 0);
            pending = iterator.current; offset = 0;
            if (pending.isEmpty) continue;
          }
          final end = min(pending.length, offset + needed - builder.length);
          builder.add(pending.sublist(offset, end)); offset = end;
        }
        await _putPart('/api/uploads/$id/part/$part', builder.takeBytes());
        sent += needed; part++; onProgress?.call(sent / size);
      }
      if (offset != pending.length || await iterator.moveNext()) throw const ApiError('تغيّر حجم الملف أثناء الرفع', 0);
      await request('/api/uploads/$id/complete', method: 'POST');
      return id;
    } catch (_) {
      try { await request('/api/uploads/$id/abort', method: 'DELETE'); } catch (_) { /* Keep original error. */ }
      rethrow;
    } finally { await iterator.cancel(); }
  }

  Future<void> _putPart(String path, Uint8List bytes) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    try {
      final req = await client.putUrl(resolve(path)).timeout(const Duration(seconds: 20));
      req.followRedirects = false;
      req.headers.contentType = ContentType.binary;
      req.headers.set('Origin', baseUri.origin);
      if (_session != null) req.cookies.add(_session!);
      req.contentLength = bytes.length;
      req.add(bytes);
      final response = await req.close().timeout(const Duration(seconds: 90));
      final value = jsonDecode(await utf8.decoder.bind(response).join().timeout(const Duration(seconds: 30)));
      if (response.statusCode == 401) clearSession();
      if (response.statusCode != 200 || value is! Map || value['ok'] != true) {
        throw ApiError(value is Map ? value['message']?.toString() ?? 'تعذر رفع الملف' : 'تعذر رفع الملف', response.statusCode);
      }
    } on ApiError { rethrow;
    } catch (_) { throw const ApiError('انقطع رفع الملف. حاول مجدداً.', 0);
    } finally { client.close(force: true); }
  }
}

class ApiError implements Exception {
  const ApiError(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}
