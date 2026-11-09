import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:shno_mano/web_api.dart';

void main() {
  late HttpServer server;
  late Api api;
  late bool active;
  late List<String> paths;
  setUp(() async {
    active = false;
    paths = [];
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    api = Api(baseUri: Uri.parse('http://127.0.0.1:${server.port}'));
    server.listen((req) async {
      paths.add('${req.method} ${req.uri.path}');
      expect(req.headers.value('authorization'), isNull);
      expect(req.headers.value('origin'), api.baseUri.origin);
      req.response.headers.contentType = ContentType.json;
      Map<String, dynamic> data = {'ok': true};
      final body = req.method == 'POST' ? jsonDecode(await utf8.decoder.bind(req).join().then((v) => v.isEmpty ? '{}' : v)) as Map : {};
      if (req.uri.path == '/api/auth/signin') {
        expect(body['identifier'], 'web-user');
        active = true;
        req.response.cookies.add(Cookie('__Host-shino_session', 'test-secret')..path = '/'..httpOnly = true);
        data = {'ok': true, 'user': {'id': 'same-web-id'}};
      } else if (!active || !req.cookies.any((c) => c.name == '__Host-shino_session' && c.value == 'test-secret')) {
        req.response.statusCode = 401;
        data = {'ok': false, 'message': 'انتهت الجلسة'};
      } else if (req.uri.path == '/api/auth/session') {
        data = {'ok': true, 'authenticated': true, 'user': {'id': 'same-web-id'}};
      } else if (req.uri.path == '/api/conversations/web-chat/messages') {
        expect(body['type'], 'text');
        expect(body['text'], 'من الهاتف إلى الويب');
        data = {'ok': true, 'message': {'id': 'web-message'}};
      } else if (req.uri.path == '/api/auth/logout') {
        active = false;
        req.response.cookies.add(Cookie('__Host-shino_session', '')..path = '/'..maxAge = 0);
      } else if (req.uri.path == '/html') {
        req.response.headers.contentType = ContentType.html;
        req.response.write('<html>Proxy error</html>');
        await req.response.close();
        return;
      }
      req.response.write(jsonEncode(data));
      await req.response.close();
    });
  });
  tearDown(() async { await server.close(force: true); });

  test('Uses web cookie, verifies account, sends text and revokes session', () async {
    final user = await api.signIn(' web-user ', 'test-password');
    expect(user['id'], 'same-web-id');
    expect(api.hasSession, isTrue);
    await api.request('/api/conversations/web-chat/messages', method: 'POST',
      body: {'type': 'text', 'text': 'من الهاتف إلى الويب'});
    await api.logout();
    expect(api.hasSession, isFalse);
    expect(paths, ['POST /api/auth/signin', 'GET /api/auth/session',
      'POST /api/conversations/web-chat/messages', 'POST /api/auth/logout']);
  });
  test('Expired session cannot silently access protected data', () async {
    await api.signIn('web-user', 'test-password');
    active = false;
    await expectLater(api.request('/api/posts'), throwsA(isA<ApiError>().having((e) => e.status, 'status', 401)));
    expect(api.hasSession, isFalse);
  });
  test('Rejects sending session to another origin or proxy HTML', () async {
    await api.signIn('web-user', 'test-password');
    await expectLater(api.request('https://example.org/api/posts'), throwsA(isA<ApiError>()));
    expect(paths.length, 2);
    await expectLater(api.request('/html'), throwsA(isA<ApiError>()));
  });
}
