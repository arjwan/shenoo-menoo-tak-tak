import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ittisal/main.dart';
void main() {
  testWidgets('Arabic login validates input and obscures password', (tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.text(title), findsOneWidget);
    expect(find.text('0'), findsNothing);
    await tester.tap(find.text('دخول'));
    await tester.pump();
    expect(find.text('أدخل اسم المستخدم وكلمة المرور'), findsOneWidget);
    final fields = tester.widgetList<TextField>(find.byType(TextField)).toList();
    expect(fields.last.obscureText, isTrue);
    expect(Directionality.of(tester.element(find.text('دخول'))), TextDirection.rtl);
  });
  testWidgets('Chat sends the required original-web text type', (tester) async {
    final api = RecordingApi();
    await tester.pumpWidget(MaterialApp(home: Chat(api: api,
      conversation: const {'id': 'web-chat', 'otherUser': {'fullName': 'مستلم'}})));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'رسالة من الهاتف');
    await tester.tap(find.byIcon(Icons.send));
    await tester.pumpAndSettle();
    expect(api.requests.any((r) => r['path'] == '/api/conversations/web-chat/messages' &&
      r['method'] == 'POST' && (r['body'] as Map)['type'] == 'text' &&
      (r['body'] as Map)['text'] == 'رسالة من الهاتف'), isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets('Unlike uses the DELETE contract instead of adding another like', (tester) async {
    final api = RecordingApi();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: PostCard(api: api,
      post: const {'id': 'web-post', 'liked': true, 'likesCount': 1, 'author': {'fullName': 'كاتب'}}))));
    await tester.tap(find.byIcon(Icons.favorite));
    await tester.pumpAndSettle();
    expect(api.requests.last['method'], 'DELETE');
  });
  testWidgets('Registration requires the original privacy agreement', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: WebAccountForm()));
    final button = find.widgetWithText(FilledButton, 'إنشاء الحساب');
    await tester.scrollUntilVisible(button, 200, scrollable: find.byType(Scrollable).first);
    expect(tester.widget<FilledButton>(button).onPressed, isNull);
    final checkbox = find.byType(CheckboxListTile);
    await tester.ensureVisible(checkbox);
    await tester.tap(checkbox);
    await tester.pump();
    expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
  });
  testWidgets('Tabs navigate without counter demo or fabricated records', (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(MaterialApp(home: Directionality(textDirection: TextDirection.rtl,
      child: Home(api: api, user: const {'fullName': 'اختبار'}))));
    await tester.pumpAndSettle();
    expect(find.text('لا توجد بيانات لعرضها بعد'), findsOneWidget);
    await tester.tap(find.text('المزيد').last);
    await tester.pumpAndSettle();
    expect(find.text('تسجيل الخروج'), findsOneWidget);
  });
}
class FakeApi extends Api {
  @override
  Future<Map<String, dynamic>> request(String path, {String method = 'GET', Map<String, dynamic>? body}) async =>
    {'ok': true, 'posts': [], 'conversations': []};
}


class RecordingApi extends Api {
  final requests = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>> request(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
    requests.add({'path': path, 'method': method, 'body': body});
    return {'ok': true, 'messages': [], 'liked': false, 'likesCount': 0};
  }
}
