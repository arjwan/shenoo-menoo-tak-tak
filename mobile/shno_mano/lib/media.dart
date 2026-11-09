import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'web_api.dart';

class MediaView extends StatefulWidget {
  const MediaView({super.key, required this.api, required this.item});
  final Api api;
  final Map<String, dynamic> item;
  @override
  State<MediaView> createState() => _MediaViewState();
}
class _MediaViewState extends State<MediaView> with WidgetsBindingObserver {
  VideoPlayerController? controller;
  bool loading = true;
  String? error;
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); loading = false; }
  Future<void> load() async {
    setState(() => loading = true);
    if (widget.item['type'] == 'image') { setState(() => loading = false); return; }
    try {
      final uri = widget.api.resolve(widget.item['url']?.toString() ?? '');
      final player = VideoPlayerController.networkUrl(uri, httpHeaders: widget.api.mediaHeaders);
      controller = player;
      await player.initialize();
      if (mounted) setState(() => loading = false);
    } catch (_) { if (mounted) setState(() { error = 'تعذر تشغيل الملف'; loading = false; }); }
  }
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) { if (state != AppLifecycleState.resumed) controller?.pause(); }
  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); controller?.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    if (widget.item['type'] == 'image') {
      return Image.network(widget.api.resolve(widget.item['url']?.toString() ?? '').toString(),
        headers: widget.api.mediaHeaders, fit: BoxFit.cover,
        errorBuilder: (_, error, stack) => const Padding(padding: EdgeInsets.all(30), child: Text('تعذر تحميل الصورة')));
    }
    if (loading) return const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator()));
    if (error != null) return Padding(padding: const EdgeInsets.all(30), child: Text(error!));
    if (controller == null) return Padding(padding: const EdgeInsets.all(24), child: FilledButton.icon(
      onPressed: load, icon: const Icon(Icons.play_arrow), label: Text(widget.item['type'] == 'audio' ? 'فتح الصوت' : 'فتح الفيديو')));
    final player = controller!;
    return ValueListenableBuilder<VideoPlayerValue>(valueListenable: player, builder: (context, value, _) => Column(children: [
      if (widget.item['type'] == 'audio') const Padding(padding: EdgeInsets.all(24), child: Icon(Icons.audiotrack, size: 48))
      else AspectRatio(aspectRatio: value.aspectRatio > 0 ? value.aspectRatio : 16 / 9, child: VideoPlayer(player)),
      Row(children: [
        IconButton(tooltip: value.isPlaying ? 'إيقاف مؤقت' : 'تشغيل', onPressed: () => value.isPlaying ? player.pause() : player.play(),
          icon: Icon(value.isPlaying ? Icons.pause : Icons.play_arrow)),
        Expanded(child: VideoProgressIndicator(player, allowScrubbing: true, padding: const EdgeInsets.all(12))),
        IconButton(tooltip: 'الصوت', onPressed: () => player.setVolume(value.volume == 0 ? 1 : 0),
          icon: Icon(value.volume == 0 ? Icons.volume_off : Icons.volume_up)),
      ]),
    ]));
  }
}
