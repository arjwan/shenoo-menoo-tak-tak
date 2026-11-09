import 'dart:async';
import 'package:file_picker/file_picker.dart';
import 'media.dart';
import 'package:url_launcher/url_launcher.dart';
import 'web_api.dart';
export 'web_api.dart';
import 'package:flutter/material.dart';

void main() => runApp(const MyApp());
const isMessenger = true;
const brand = isMessenger ? Color(0xFF004563) : Color(0xFF65158E);
const accent = Color(0xFF922AFF);
const title = isMessenger ? 'اتصال' : 'شنو منو';

List<Map<String, dynamic>> rows(dynamic value) => value is List
    ? value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : [];
Map<String, dynamic> object(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : {};
String name(dynamic value) {
  final u = object(value);
  return (u['fullName'] ?? u['displayName'] ?? u['username'] ?? '').toString();
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: title, debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: brand),
      scaffoldBackgroundColor: const Color(0xFFF7F4FF),
      appBarTheme: const AppBarTheme(backgroundColor: brand, foregroundColor: Colors.white),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(18)))),
    builder: (_, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
    home: const SignIn(),
  );
}
class SignIn extends StatefulWidget {
  const SignIn({super.key});
  @override
  State<SignIn> createState() => _SignInState();
}
class _SignInState extends State<SignIn> {
  final identifier = TextEditingController();
  final password = TextEditingController();
  bool busy = false, obscure = true;
  String? error;
  @override
  void dispose() { identifier.dispose(); password.dispose(); super.dispose(); }
  Future<void> login() async {
    if (busy) return;
    if (identifier.text.trim().isEmpty || password.text.isEmpty) {
      setState(() => error = 'أدخل اسم المستخدم وكلمة المرور'); return;
    }
    setState(() { busy = true; error = null; });
    try {
      final api = Api();
      final user = await api.signIn(identifier.text.trim(), password.text);
      if (!mounted) return;
      password.clear();
      await Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
        builder: (_) => Home(api: api, user: user)));
    } catch (e) { if (mounted) setState(() => error = e.toString());
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(body: Container(
    decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topRight,
      end: Alignment.bottomLeft, colors: [brand, accent, Color(0xFFF7F4FF)])),
    child: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Column(children: [
        const Icon(Icons.forum_rounded, size: 80, color: Colors.white),
        const SizedBox(height: 12),
        const Text(title, style: TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold)),
        const Text(isMessenger ? 'المكالمات والمحادثات' : 'المجتمع ومدرسة سومر',
          style: TextStyle(color: Colors.white, fontSize: 18)),
        const SizedBox(height: 30),
        Card(child: Padding(padding: const EdgeInsets.all(22), child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('تسجيل الدخول', style: TextStyle(fontSize: 23, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            TextField(controller: identifier, enabled: !busy,
              autofillHints: const [AutofillHints.username],
              decoration: const InputDecoration(labelText: 'اسم المستخدم أو البريد الإلكتروني')),
            const SizedBox(height: 16),
            TextField(controller: password, enabled: !busy, obscureText: obscure,
              onSubmitted: (_) => login(), autofillHints: const [AutofillHints.password],
              decoration: InputDecoration(labelText: 'كلمة المرور',
                suffixIcon: IconButton(onPressed: () => setState(() => obscure = !obscure),
                  icon: Icon(obscure ? Icons.visibility : Icons.visibility_off)))),
            if (error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            const SizedBox(height: 20),
            FilledButton(onPressed: busy ? null : login, child: Padding(
              padding: const EdgeInsets.all(14), child: Text(busy ? 'جارٍ التحقق...' : 'دخول'))),
            TextButton(onPressed: busy ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => const WebAccountForm())), child: const Text('إنشاء حساب')),
          ]))),
      ])))))));
}

class Home extends StatefulWidget {
  const Home({super.key, required this.api, required this.user});
  final Api api;
  final Map<String, dynamic> user;
  @override
  State<Home> createState() => _HomeState();
}
class _HomeState extends State<Home> {
  int selected = 0;
  String feed = 'posts';
  bool redirecting = false;
  @override
  void initState() { super.initState(); widget.api.onUnauthorized = expired; }
  void expired() {
    if (redirecting || !mounted) return;
    redirecting = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => const SignIn()), (_) => false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('انتهت الجلسة. سجل الدخول مجدداً.')));
    });
  }
  @override
  void dispose() { widget.api.onUnauthorized = null; super.dispose(); }

  Future<void> logout() async {
    try { await widget.api.logout(); } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => const SignIn()), (_) => false);
  }
  void open(Widget page) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  @override
  Widget build(BuildContext context) {
    final labels = isMessenger
      ? ['المحادثات', 'المكالمات', 'جهات الاتصال', 'الإشعارات', 'المزيد']
      : ['المجتمع', 'مدرسة سومر', 'اكتشف', 'الرسائل', 'المزيد'];
    Widget body;
    if (selected == 4) {
      body = ListView(children: [
        ListTile(leading: const Icon(Icons.person_outline), title: Text(name(widget.user)),
          subtitle: Text(widget.user['username']?.toString() ?? ''),
          onTap: () => open(WebAccountForm(api: widget.api))),
        ListTile(leading: const Icon(Icons.logout), title: const Text('تسجيل الخروج'), onTap: logout),
      ]);
    } else if (isMessenger && selected == 1) {
      body = const EmptyState(icon: Icons.call_outlined,
        text: 'لا يمكن إجراء المكالمات من هذه النسخة بعد. ربط الصوت والفيديو قيد الاستكمال.');
    } else if (isMessenger && selected == 2) {
      body = DataPanel(api: widget.api, path: '/api/friends', field: 'friends', render: (item) =>
        ListTile(leading: const CircleAvatar(child: Icon(Icons.person_outline)), title: Text(name(item)),
          onTap: () async {
            try {
              final result = await widget.api.request('/api/conversations/${item['id'] ?? item['_id']}', method: 'POST');
              if (!context.mounted) return;
              open(Chat(api: widget.api, conversation: {...object(result['conversation']), 'otherUser': item}));
            } catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
          }));
    } else if (isMessenger && selected == 3) {
      body = NotificationList(api: widget.api);
    } else if (!isMessenger && selected == 2) {
      body = Discover(api: widget.api);
    } else if (!isMessenger && selected == 1) {
      body = DataPanel(api: widget.api, path: '/api/school/curriculum/catalog', field: 'items',
        render: (item) => Card(child: ListTile(leading: const Icon(Icons.school),
          title: Text(item['title']?.toString() ?? ''),
          subtitle: Text([item['stage'], item['grade'], item['subject']].whereType<String>().join(' • ')),
          onTap: () => open(Scaffold(appBar: AppBar(title: Text(item['title']?.toString() ?? 'المنهج')),
            body: ListView(padding: const EdgeInsets.all(20), children: [
              Text(item['content']?.toString() ?? ''),
              const SizedBox(height: 16),
              SelectableText(item['sourceUrl']?.toString() ?? object(item['file'])['url']?.toString() ?? ''),
              FilledButton.icon(onPressed: () async {
                final uri = Uri.tryParse(item['sourceUrl']?.toString() ?? object(item['file'])['url']?.toString() ?? '');
                try {
                  if (uri == null || uri.scheme != 'https' || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
                    throw const ApiError('تعذر فتح الكتاب', 0);
                  }
                } catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
              }, icon: const Icon(Icons.menu_book), label: const Text('فتح الكتاب الأصلي')),
            ]))))));
    } else if ((isMessenger && selected == 0) || (!isMessenger && selected == 3)) {
      body = DataPanel(api: widget.api, path: '/api/conversations', field: 'conversations', pollEvery: const Duration(seconds: 10),
        render: (item) => Card(child: ListTile(
          leading: const CircleAvatar(backgroundColor: brand, child: Icon(Icons.chat_bubble_outline, color: Colors.white)),
          title: Text(name(item['otherUser']), style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text(object(item['lastMessage'])['text']?.toString() ?? 'مرفق'),
          trailing: (item['unreadCount'] is num && item['unreadCount'] > 0)
            ? CircleAvatar(radius: 14, child: Text('${item['unreadCount']}')) : null,
          onTap: () => open(Chat(api: widget.api, conversation: item)))));
    } else {
      body = DataPanel(api: widget.api, path: '/api/$feed', field: feed,
        render: (item) => feed == 'stories' ? Card(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ListTile(title: Text(name(item['author']))),
          Padding(padding: const EdgeInsets.all(16), child: Text(item['text']?.toString() ?? '')),
          for (final media in rows(item['media'])) MediaView(api: widget.api, item: media),
        ])) : PostCard(key: ValueKey(item['id']), api: widget.api, post: {
          ...item, if (feed == 'reels') 'likesCount': item['likes'],
        }));
    }
    return Scaffold(
      appBar: AppBar(title: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 27)),
        Text(isMessenger ? 'Ittisal' : 'Tak Tak', style: TextStyle(fontSize: 13)),
      ]), actions: [
        IconButton(tooltip: 'بحث', icon: const Icon(Icons.search), onPressed: () => open(Scaffold(
          appBar: AppBar(title: const Text('البحث')), body: Discover(api: widget.api)))),
        IconButton(tooltip: 'الإشعارات', icon: const Icon(Icons.notifications_outlined),
          onPressed: () => open(Scaffold(appBar: AppBar(title: const Text('الإشعارات')),
            body: NotificationList(api: widget.api)))),
      ]),
      body: Column(children: [
        Padding(padding: const EdgeInsets.all(10), child: Row(children: List.generate(3, (i) =>
          Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: ChoiceChip(
            selected: selected == i, label: Text(labels[i], style: const TextStyle(fontSize: 12)),
            onSelected: (_) => setState(() => selected = i))))))),
        if (!isMessenger && selected == 0) Padding(padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: ['posts', 'stories', 'reels'].map((kind) => Expanded(child: TextButton(
            onPressed: () => setState(() => feed = kind), child: Text({'posts': 'المنشورات', 'stories': 'القصص', 'reels': 'الريلز'}[kind]!,
              style: TextStyle(fontWeight: feed == kind ? FontWeight.bold : FontWeight.normal))))).toList())),
        Expanded(child: body),
      ]),
      floatingActionButton: !isMessenger && selected == 0
        ? FloatingActionButton(onPressed: () => open(Compose(api: widget.api, purpose: feed == 'stories' ? 'stories' : 'posts')),
          backgroundColor: accent, foregroundColor: Colors.white, child: const Icon(Icons.add)) : null,
      bottomNavigationBar: NavigationBar(selectedIndex: selected,
        onDestinationSelected: (i) => setState(() => selected = i), destinations: List.generate(5, (i) =>
          NavigationDestination(icon: Icon((isMessenger
            ? [Icons.chat_bubble_outline, Icons.call_outlined, Icons.contacts_outlined, Icons.notifications_outlined, Icons.menu]
            : [Icons.groups_outlined, Icons.school_outlined, Icons.explore_outlined, Icons.chat_outlined, Icons.menu])[i]),
            label: labels[i]))),
    );
  }
}
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.text, this.icon = Icons.inbox_outlined});
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(28),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, color: brand, size: 60), const SizedBox(height: 16),
      Text(text, textAlign: TextAlign.center),
    ])));
}
class DataPanel extends StatefulWidget {
  const DataPanel({super.key, required this.api, required this.path, required this.field, required this.render, this.pollEvery, this.onLoaded});
  final Api api;
  final String path, field;
  final Duration? pollEvery;
  final void Function(Map<String, dynamic>)? onLoaded;
  final Widget Function(Map<String, dynamic>) render;
  @override
  State<DataPanel> createState() => _DataPanelState();
}
class _DataPanelState extends State<DataPanel> with WidgetsBindingObserver {
  Timer? poll;
  bool fetching = false;
  Future<Map<String, dynamic>> fetch() async {
    fetching = true;
    try {
      final value = await widget.api.request(widget.path);
      if (value[widget.field] is! List) throw const ApiError('استجابة الخدمة غير مكتملة', 0);
      if (mounted) widget.onLoaded?.call(value);
      return value;
    } finally { fetching = false; }
  }
  void startPolling() {
    poll?.cancel();
    if (widget.pollEvery != null) {
      poll = Timer.periodic(widget.pollEvery!, (_) { if (!fetching && mounted) unawaited(reload()); });
    }
  }
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) { startPolling(); unawaited(reload()); } else { poll?.cancel(); }
  }
  @override
  void dispose() { poll?.cancel(); WidgetsBinding.instance.removeObserver(this); super.dispose(); }
  late Future<Map<String, dynamic>> data;
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); data = fetch(); startPolling(); }
  @override
  void didUpdateWidget(DataPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.path != widget.path) { data = fetch(); }
    if (oldWidget.pollEvery != widget.pollEvery) startPolling();
  }
  Future<void> reload() async {
    final next = fetch();
    setState(() => data = next);
    try { await next; } catch (_) { /* Displayed by FutureBuilder. */ }
  }
  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(future: data, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) { return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Padding(padding: const EdgeInsets.all(24), child: Text(snapshot.error.toString(), textAlign: TextAlign.center)),
      FilledButton(onPressed: reload, child: const Text('إعادة المحاولة')),
    ])); }
    final items = rows(snapshot.data?[widget.field]);
    return RefreshIndicator(onRefresh: reload, child: ListView(
      physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(12),
      children: items.isEmpty ? [const SizedBox(height: 80), const EmptyState(text: 'لا توجد بيانات لعرضها بعد')]
        : items.map(widget.render).toList()));
  });
}
class PostCard extends StatefulWidget {
  const PostCard({super.key, required this.api, required this.post});
  final Api api;
  final Map<String, dynamic> post;
  @override
  State<PostCard> createState() => _PostCardState();
}
class _PostCardState extends State<PostCard> {
  bool busy = false;
  late bool liked = widget.post['liked'] == true;
  late int likes = (widget.post['likesCount'] as num?)?.toInt() ?? 0;
  Future<void> like() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final r = await widget.api.request('/api/posts/${widget.post['id']}/like', method: liked ? 'DELETE' : 'POST');
      if (mounted) setState(() { liked = r['liked'] == true; likes = (r['likesCount'] as num?)?.toInt() ?? likes; });
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final media = rows(widget.post['media']);
    return Card(margin: const EdgeInsets.only(bottom: 16), clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ListTile(leading: const CircleAvatar(child: Icon(Icons.person_outline)),
          title: Text(name(widget.post['author']), style: const TextStyle(fontWeight: FontWeight.bold))),
        if ((widget.post['text'] ?? '').toString().isNotEmpty)
          Padding(padding: const EdgeInsets.all(16), child: Text(widget.post['text'].toString())),
        for (final item in media) MediaView(api: widget.api, item: item),
        Row(children: [TextButton.icon(onPressed: busy ? null : like,
          icon: Icon(liked ? Icons.favorite : Icons.favorite_border, color: liked ? Colors.red : brand),
          label: Text('$likes')), const Spacer(),
          TextButton.icon(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => Comments(api: widget.api, postId: widget.post['id'].toString()))),
            icon: const Icon(Icons.chat_bubble_outline), label: Text('${widget.post['commentsCount'] ?? 0} تعليق'))]),
      ]));
  }
}
class Compose extends StatefulWidget {
  const Compose({super.key, required this.api, this.purpose = 'posts'});
  final Api api;
  final String purpose;
  @override
  State<Compose> createState() => _ComposeState();
}
class _ComposeState extends State<Compose> {
  final text = TextEditingController();
  PlatformFile? attachment;
  double progress = 0;
  bool busy = false;
  static const mime = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
    'mp4': 'video/mp4', 'webm': 'video/webm', 'mp3': 'audio/mpeg'};
  Future<void> pick() async {
    try {
      final file = await FilePicker.pickFile(type: FileType.custom,
        allowedExtensions: mime.keys.where((k) => widget.purpose != 'stories' || k != 'mp3').toList());
      if (file == null || !mounted) return;
      final size = await file.length();
      if (!mounted) return;
      if (size == null || size < 1 || size > 100 * 1024 * 1024) throw const ApiError('الحد الأقصى للملف 100 ميغابايت', 413);
      setState(() => attachment = file);
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
  }
  @override
  void dispose() { text.dispose(); super.dispose(); }
  Future<void> send() async {
    if (busy || (text.text.trim().isEmpty && attachment == null)) return;
    setState(() { busy = true; progress = 0; });
    try {
      String? uploadId;
      final file = attachment;
      if (file != null) {
        final type = mime[file.extension?.toLowerCase()];
        final size = await file.length();
        if (type == null || size == null) throw const ApiError('تعذر قراءة الملف', 0);
        uploadId = await widget.api.uploadMedia(name: file.name, mime: type, size: size, stream: file.readAsByteStream(), purpose: widget.purpose,
          onProgress: (value) { if (mounted) setState(() => progress = value); });
      }
      if (!mounted) {
        if (uploadId != null) { try { await widget.api.request('/api/uploads/$uploadId/abort', method: 'DELETE'); } catch (_) {} }
        return;
      }
      await widget.api.request('/api/${widget.purpose}', method: 'POST', body: {'text': text.text.trim(), 'visibility': 'everyone',
        if (uploadId != null && widget.purpose == 'posts') 'uploadId': uploadId,
        if (uploadId != null && widget.purpose == 'stories') 'uploads': {'main': uploadId},
      });
      if (mounted) Navigator.of(context).pop();
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(widget.purpose == 'stories' ? 'إنشاء قصة' : 'إنشاء منشور')),
    body: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
      TextField(controller: text, maxLength: widget.purpose == 'stories' ? 1000 : 5000, minLines: 4, maxLines: 8,
        decoration: const InputDecoration(hintText: 'ماذا تود أن تشارك؟')),
      OutlinedButton.icon(onPressed: busy ? null : pick, icon: const Icon(Icons.attach_file), label: Text(attachment?.name ?? 'إضافة صورة أو فيديو أو صوت')),
      if (attachment != null && !busy) TextButton(onPressed: () => setState(() => attachment = null), child: const Text('إزالة المرفق')),
      if (busy && attachment != null) LinearProgressIndicator(value: progress),
      FilledButton(onPressed: busy ? null : send, child: Text(busy ? 'جارٍ النشر...' : 'نشر للجميع')),
    ])));
}
class Chat extends StatefulWidget {
  const Chat({super.key, required this.api, required this.conversation});
  final Api api;
  final Map<String, dynamic> conversation;
  @override
  State<Chat> createState() => _ChatState();
}
class _ChatState extends State<Chat> {
  final text = TextEditingController();
  int revision = 0;
  String? lastRead;
  Future<void> markRead(Map<String, dynamic> value) async {
    final messages = rows(value['messages']);
    final remote = messages.where((m) => m['mine'] != true).toList();
    if (remote.isEmpty) return;
    final id = (remote.last['id'] ?? remote.last['_id'])?.toString();
    if (id == null || id == lastRead) return;
    try {
      await widget.api.request('/api/conversations/${widget.conversation['id']}/read', method: 'PATCH');
      lastRead = id;
    } catch (_) { /* Next successful refresh retries the read receipt. */ }
  }
  bool busy = false;
  String get path => '/api/conversations/${widget.conversation['id']}/messages';
  @override
  void dispose() { text.dispose(); super.dispose(); }
  Future<void> send() async {
    if (busy || text.text.trim().isEmpty) return;
    setState(() => busy = true);
    try {
      await widget.api.request(path, method: 'POST', body: {'type': 'text', 'text': text.text.trim()});
      if (mounted) setState(() { text.clear(); revision++; });
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(name(widget.conversation['otherUser']))),
    body: Column(children: [
      Expanded(child: DataPanel(key: ValueKey(revision), api: widget.api, path: path, field: 'messages', pollEvery: const Duration(seconds: 5), onLoaded: (v) => unawaited(markRead(v)),
        render: (item) => Align(alignment: item['mine'] == true ? Alignment.centerRight : Alignment.centerLeft,
          child: Card(color: item['mine'] == true ? const Color(0xFFE8D9FF) : Colors.white,
            child: Padding(padding: const EdgeInsets.all(14),
              child: Text(item['deletedForEveryone'] == true ? 'حُذفت الرسالة' : item['text']?.toString() ?? 'مرفق')))))),
      SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(10), child: Row(children: [
        Expanded(child: TextField(controller: text, maxLength: 5000,
          decoration: const InputDecoration(hintText: 'اكتب رسالة', counterText: ''))),
        IconButton(onPressed: busy ? null : send, icon: const Icon(Icons.send, color: brand)),
      ]))),
    ]));
}


class WebAccountForm extends StatefulWidget {
  const WebAccountForm({super.key, this.api});
  final Api? api;
  @override
  State<WebAccountForm> createState() => _WebAccountFormState();
}
class _WebAccountFormState extends State<WebAccountForm> {
  final form = GlobalKey<FormState>();
  final fullName = TextEditingController(), username = TextEditingController(), email = TextEditingController();
  final password = TextEditingController(), confirm = TextEditingController(), bio = TextEditingController();
  Map<String, dynamic> original = {};
  bool loading = false, busy = false;
  bool accepted = false;
  String? error;
  bool get editing => widget.api != null;
  @override
  void initState() { super.initState(); if (editing) unawaited(load()); }
  Future<void> load() async {
    setState(() { loading = true; error = null; });
    try {
      final result = await widget.api!.request('/api/users/me');
      final user = object(result['user']);
      if (!mounted) return;
      original = user;
      fullName.text = name(user); username.text = user['username']?.toString() ?? '';
      email.text = user['email']?.toString() ?? '';
      bio.text = object(user['profile'])['bio']?.toString() ?? user['bio']?.toString() ?? '';
    } catch (e) { if (mounted) setState(() => error = e.toString());
    } finally { if (mounted) setState(() => loading = false); }
  }
  @override
  void dispose() { for (final c in [fullName, username, email, password, confirm, bio]) { c.dispose(); } super.dispose(); }
  Future<void> save() async {
    if (busy || !(form.currentState?.validate() ?? false)) return;
    setState(() { busy = true; error = null; });
    try {
      final api = widget.api ?? Api();
      if (editing) {
        await api.request('/api/users/me', method: 'PATCH', body: {
          'fullName': fullName.text.trim(), 'username': username.text.trim(),
          'birthDate': original['birthDate']?.toString().split('T').first ?? '',
          'gender': original['gender'] ?? 'other',
        });
        await api.request('/api/users/me/profile', method: 'PATCH', body: {
          ...object(original['profile']), 'bio': bio.text.trim(),
        });
      } else {
        await api.request('/api/auth/signup', method: 'POST', body: {
          'fullName': fullName.text.trim(), 'username': username.text.trim(),
          'email': email.text.trim(), 'password': password.text, 'confirmPassword': confirm.text,
          'privacyAccepted': accepted, 'termsAccepted': accepted,
        });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(editing ? 'حُفظت البيانات في حساب الويب' : 'تم إنشاء الحساب. يمكنك تسجيل الدخول الآن.')));
      Navigator.of(context).pop();
    } catch (e) { if (mounted) setState(() => error = e.toString());
    } finally { if (mounted) setState(() => busy = false); }
  }
  Widget field(TextEditingController controller, String label, {bool secret = false, String? Function(String?)? validator}) =>
    Padding(padding: const EdgeInsets.only(bottom: 16), child: TextFormField(controller: controller,
      enabled: !busy, obscureText: secret, decoration: InputDecoration(labelText: label),
      validator: validator ?? (v) => v == null || v.trim().isEmpty ? 'هذا الحقل مطلوب' : null));
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(editing ? 'حسابي' : 'إنشاء حساب')),
    body: loading ? const Center(child: CircularProgressIndicator()) : Form(key: form, child: ListView(
      padding: const EdgeInsets.all(20), children: [
        if (error != null) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text(error!)),
        if (editing && original.isEmpty) FilledButton(onPressed: load, child: const Text('إعادة المحاولة'))
        else ...[
          field(fullName, 'الاسم الكامل'), field(username, 'اسم المستخدم'),
          if (!editing) ...[
            field(email, 'البريد الإلكتروني', validator: (v) => v != null && RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v.trim()) ? null : 'أدخل بريداً صحيحاً'),
            field(password, 'كلمة المرور', secret: true, validator: (v) => v != null && v.length >= 10 && v.length <= 128 ? null : 'كلمة المرور من 10 إلى 128 حرفاً'),
            field(confirm, 'تأكيد كلمة المرور', secret: true, validator: (v) => v == password.text ? null : 'كلمتا المرور غير متطابقتين'),
          ] else field(bio, 'نبذة عنك', validator: (v) => (v?.length ?? 0) <= 500 ? null : 'الحد الأقصى 500 حرف'),
          if (!editing) ...[
            CheckboxListTile(value: accepted, onChanged: busy ? null : (value) => setState(() => accepted = value ?? false),
              title: const Text('قرأت اتفاقية الخصوصية والأمان وأوافق عليها')),
            TextButton(onPressed: () async {
              try { await launchUrl(Uri.parse('https://shinomino.com/privacy.html'), mode: LaunchMode.externalApplication); }
              catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
            }, child: const Text('قراءة الاتفاقية')),
          ],
          FilledButton(onPressed: busy || (!editing && !accepted) ? null : save, child: Text(busy ? 'جارٍ الحفظ...' : editing ? 'حفظ' : 'إنشاء الحساب')),
        ],
      ])));
}
class Comments extends StatefulWidget {
  const Comments({super.key, required this.api, required this.postId});
  final Api api;
  final String postId;
  @override
  State<Comments> createState() => _CommentsState();
}
class _CommentsState extends State<Comments> {
  final text = TextEditingController();
  bool busy = false;
  int revision = 0;
  String get path => '/api/posts/${widget.postId}/comments';
  @override
  void dispose() { text.dispose(); super.dispose(); }
  Future<void> send() async {
    if (busy || text.text.trim().isEmpty) return;
    setState(() => busy = true);
    try {
      await widget.api.request(path, method: 'POST', body: {'text': text.text.trim()});
      if (mounted) setState(() { text.clear(); revision++; });
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('التعليقات')),
    body: Column(children: [
      Expanded(child: DataPanel(key: ValueKey(revision), api: widget.api, path: path, field: 'comments',
        render: (item) => Card(child: ListTile(title: Text(name(item['author'])), subtitle: Text(item['text']?.toString() ?? ''))))),
      SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
        Expanded(child: TextField(controller: text, maxLength: 2000, decoration: const InputDecoration(hintText: 'اكتب تعليقاً', counterText: ''))),
        IconButton(onPressed: busy ? null : send, icon: const Icon(Icons.send)),
      ]))),
    ]));
}

class Discover extends StatefulWidget {
  const Discover({super.key, required this.api});
  final Api api;
  @override
  State<Discover> createState() => _DiscoverState();
}
class _DiscoverState extends State<Discover> {
  final text = TextEditingController();
  Timer? debounce;
  String query = '';
  @override
  void dispose() { debounce?.cancel(); text.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Column(children: [
    Padding(padding: const EdgeInsets.all(12), child: TextField(controller: text, maxLength: 60,
      decoration: const InputDecoration(labelText: 'البحث عن الأشخاص', prefixIcon: Icon(Icons.search)),
      onChanged: (value) { debounce?.cancel(); debounce = Timer(const Duration(milliseconds: 400), () {
        if (mounted) setState(() => query = value.trim());
      }); })),
    Expanded(child: query.length < 2 ? const EmptyState(text: 'اكتب حرفين على الأقل للبحث')
      : DataPanel(api: widget.api, path: '/api/users/search?q=${Uri.encodeQueryComponent(query)}', field: 'users',
        render: (item) => ListTile(title: Text(name(item)), subtitle: Text(item['username']?.toString() ?? ''),
          leading: const CircleAvatar(child: Icon(Icons.person)),
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => WebUser(api: widget.api, id: item['id'].toString())))))),
  ]);
}
class WebUser extends StatefulWidget {
  const WebUser({super.key, required this.api, required this.id});
  final Api api;
  final String id;
  @override
  State<WebUser> createState() => _WebUserState();
}
class _WebUserState extends State<WebUser> {
  late Future<Map<String, dynamic>> data;
  bool busy = false;
  String get path => '/api/users/${widget.id}';
  @override
  void initState() { super.initState(); data = widget.api.request(path); }
  Future<void> follow(bool following) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await widget.api.request('$path/follow', method: following ? 'DELETE' : 'POST');
      if (mounted) setState(() => data = widget.api.request(path));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> chat(Map<String, dynamic> user) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await widget.api.request('/api/conversations/${widget.id}', method: 'POST');
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => Chat(api: widget.api,
        conversation: {...object(result['conversation']), 'otherUser': user})));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('الملف الشخصي')),
    body: FutureBuilder<Map<String, dynamic>>(future: data, builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
      if (snapshot.hasError) return EmptyState(text: snapshot.error.toString());
      final user = object(snapshot.data?['user']);
      return ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.account_circle, size: 80, color: brand),
        Text(name(user), textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        Text('@${user['username'] ?? ''}', textAlign: TextAlign.center),
        Text('${user['followersCount'] ?? 0} متابع', textAlign: TextAlign.center),
        FilledButton(onPressed: busy ? null : () => follow(user['isFollowing'] == true),
          child: Text(user['isFollowing'] == true ? 'إلغاء المتابعة' : 'متابعة')),
        OutlinedButton.icon(onPressed: busy ? null : () => chat(user), icon: const Icon(Icons.chat), label: const Text('إرسال رسالة')),
      ]);
    }));
}
class NotificationList extends StatefulWidget {
  const NotificationList({super.key, required this.api});
  final Api api;
  @override
  State<NotificationList> createState() => _NotificationListState();
}
class _NotificationListState extends State<NotificationList> {
  int revision = 0;
  bool busy = false;
  Future<void> read(String? id) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await widget.api.request(id == null ? '/api/social/notifications/read-all' : '/api/social/notifications/$id/read', method: 'PATCH');
      if (mounted) setState(() => revision++);
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => Column(children: [
    TextButton(onPressed: busy ? null : () => read(null), child: const Text('تعليم الكل كمقروء')),
    Expanded(child: DataPanel(key: ValueKey(revision), api: widget.api,
      path: '/api/social/notifications', field: 'notifications', pollEvery: const Duration(seconds: 15),
      render: (item) => ListTile(leading: Icon(item['readAt'] == null ? Icons.notifications_active : Icons.notifications_none),
        title: Text(item['text']?.toString() ?? ''), onTap: busy ? null : () => read(item['id']?.toString())))),
  ]);
}
