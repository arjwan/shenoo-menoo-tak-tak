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
