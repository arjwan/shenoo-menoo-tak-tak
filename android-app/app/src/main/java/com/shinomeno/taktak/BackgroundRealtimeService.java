package com.shinomeno.taktak;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import org.json.JSONObject;

import java.net.URISyntaxException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.socket.client.IO;
import io.socket.client.Socket;

public final class BackgroundRealtimeService extends Service {
    public static final String PREFS = "shno_native";
    public static final String KEY_TOKEN = "token";
    public static final String KEY_BACKGROUND = "background_enabled";
    public static final String KEY_NOTIFICATION_PREFS = "notification_prefs";

    private static final String API = "https://shino-mino-tak-tak.duckdns.org";
    private static final String CHANNEL_REALTIME = "shno_realtime";
    private static final String CHANNEL_MESSAGES = "shno_messages";
    private static final String CHANNEL_CALLS = "shno_calls";
    private static final String CHANNEL_MISSED = "shno_missed_calls";
    private static final int SERVICE_NOTIFICATION_ID = 5001;
    private static final int CALL_NOTIFICATION_ID = 5002;
    private static final int MESSAGE_NOTIFICATION_BASE = 5200;
    private static final int MISSED_NOTIFICATION_BASE = 5400;
    private static final String ACTION_REJECT = "com.shinomeno.taktak.REJECT_CALL";
    private static final String EXTRA_CALL_ID = "callId";
    private static final String EXTRA_FROM = "from";
    private static final String EXTRA_CONVERSATION_ID = "conversationId";
    private static final String EXTRA_CALL_TYPE = "callType";

    private Socket socket;
    private Ringtone ringtone;
    private String ringingCallId;
    private String ringingCallerName;
    private String ringingFrom;
    private String ringingConversationId;
    private String ringingType;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_REJECT.equals(intent.getAction())) {
            rejectCurrentCall(intent);
            return START_STICKY;
        }
        if (!isBackgroundEnabled() || token().isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(SERVICE_NOTIFICATION_ID, realtimeNotification());
        connectSocket();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel realtime = new NotificationChannel(CHANNEL_REALTIME, "عمل شنو منو في الخلفية", NotificationManager.IMPORTANCE_LOW);
        realtime.setDescription("يحافظ على استقبال الرسائل والمكالمات عندما تسمح للتطبيق بالعمل في الخلفية");
        realtime.setShowBadge(false);

        NotificationChannel messages = new NotificationChannel(CHANNEL_MESSAGES, "رسائل شنو منو", NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription("تنبيهات الرسائل الجديدة");
        messages.enableVibration(true);

        NotificationChannel calls = new NotificationChannel(CHANNEL_CALLS, "مكالمات شنو منو", NotificationManager.IMPORTANCE_HIGH);
        calls.setDescription("المكالمات الصوتية ومكالمات الفيديو الواردة");
        calls.enableVibration(true);
        calls.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        AudioAttributes callAudio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        calls.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), callAudio);

        NotificationChannel missed = new NotificationChannel(CHANNEL_MISSED, "المكالمات الفائتة", NotificationManager.IMPORTANCE_HIGH);
        missed.setDescription("تنبيهات المكالمات التي لم يتم الرد عليها");
        missed.enableVibration(true);

        manager.createNotificationChannel(realtime);
        manager.createNotificationChannel(messages);
        manager.createNotificationChannel(calls);
        manager.createNotificationChannel(missed);
    }

    private Notification.Builder builder(String channel) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return new Notification.Builder(this, channel);
        return new Notification.Builder(this);
    }

    private Notification realtimeNotification() {
        PendingIntent open = PendingIntent.getActivity(
            this,
            SERVICE_NOTIFICATION_ID,
            new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return builder(CHANNEL_REALTIME)
            .setSmallIcon(com.shinomeno.taktak.R.drawable.ic_launcher)
            .setContentTitle("شنو منو")
            .setContentText("استقبال الرسائل والمكالمات في الخلفية مفعّل")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setContentIntent(open)
            .build();
    }

    private void connectSocket() {
        if (socket != null) {
            if (!socket.connected()) socket.connect();
            return;
        }
        IO.Options options = new IO.Options();
        options.reconnection = true;
        options.reconnectionAttempts = Integer.MAX_VALUE;
        options.reconnectionDelay = 1000;
        options.reconnectionDelayMax = 10000;
        options.timeout = 20000;
        Map<String, List<String>> headers = new HashMap<>();
        headers.put("Authorization", Collections.singletonList("Bearer " + token()));
        options.extraHeaders = headers;
        try {
            socket = IO.socket(API, options);
        } catch (URISyntaxException error) {
            Log.e("ShnoBackground", "Socket URL error", error);
            return;
        }

        socket.on(Socket.EVENT_CONNECT, args -> Log.d("ShnoBackground", "connected"));
        socket.on(Socket.EVENT_CONNECT_ERROR, args -> Log.w("ShnoBackground", "connect error"));
        socket.on("call:invite", args -> {
            JSONObject payload = firstJson(args);
            if (payload != null) handleIncomingCall(payload);
        });
        socket.on("call:accept", args -> clearCall(false));
        socket.on("call:reject", args -> finishIncomingAsMissed(args));
        socket.on("call:end", args -> finishIncomingAsMissed(args));
        socket.on("private:message", args -> {
            JSONObject payload = firstJson(args);
            if (payload != null) postMessageNotification(payload);
        });
        socket.connect();
    }

    private JSONObject firstJson(Object[] args) {
        if (args == null || args.length == 0 || !(args[0] instanceof JSONObject)) return null;
        return (JSONObject) args[0];
    }

    private void handleIncomingCall(JSONObject payload) {
        if (!pref("calls", true)) return;
        String callId = payload.optString("callId", "").trim();
        String from = payload.optString("from", "").trim();
        if (callId.isEmpty() || from.isEmpty()) return;

        ringingCallId = callId;
        ringingFrom = from;
        ringingConversationId = payload.optString("conversationId", "").trim();
        ringingType = "video".equals(payload.optString("type")) ? "video" : "audio";
        ringingCallerName = payload.optString("callerName", "مستخدم شنو منو").trim();
        if (ringingCallerName.isEmpty()) ringingCallerName = "مستخدم شنو منو";

        Intent openIntent = new Intent(this, MainActivity.class)
            .putExtra("incoming_call", true)
            .putExtra("incoming_user", ringingFrom)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(
            this,
            callId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent rejectIntent = new Intent(this, BackgroundRealtimeService.class)
            .setAction(ACTION_REJECT)
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_FROM, ringingFrom)
            .putExtra(EXTRA_CONVERSATION_ID, ringingConversationId)
            .putExtra(EXTRA_CALL_TYPE, ringingType);
        PendingIntent reject = PendingIntent.getService(
            this,
            callId.hashCode() + 1,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String label = "video".equals(ringingType) ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة";
        Notification notification = builder(CHANNEL_CALLS)
            .setSmallIcon(com.shinomeno.taktak.R.drawable.ic_launcher)
            .setContentTitle(label)
            .setContentText(ringingCallerName)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .setCategory(Notification.CATEGORY_CALL)
            .setPriority(Notification.PRIORITY_MAX)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(new Notification.Action.Builder(com.shinomeno.taktak.R.drawable.ic_launcher, "فتح المكالمة", open).build())
            .addAction(new Notification.Action.Builder(com.shinomeno.taktak.R.drawable.ic_launcher, "رفض", reject).build())
            .build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(CALL_NOTIFICATION_ID, notification);
        startRingtone();
    }

    private void startRingtone() {
        if (!pref("sound", true)) return;
        stopRingtone();
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ringtone = RingtoneManager.getRingtone(getApplicationContext(), uri);
        if (ringtone != null) ringtone.play();
    }

    private void stopRingtone() {
        if (ringtone != null) {
            try { if (ringtone.isPlaying()) ringtone.stop(); } catch (Exception ignored) {}
            ringtone = null;
        }
    }

    private void rejectCurrentCall(Intent intent) {
        if (socket == null) connectSocket();
        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String from = intent.getStringExtra(EXTRA_FROM);
        String conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID);
        String type = intent.getStringExtra(EXTRA_CALL_TYPE);
        if (socket != null && callId != null) {
            JSONObject payload = new JSONObject();
            try {
                payload.put("callId", callId);
                payload.put("userId", from == null ? "" : from);
                payload.put("conversationId", conversationId == null ? "" : conversationId);
                payload.put("type", type == null ? "audio" : type);
                payload.put("reason", "rejected");
            } catch (Exception ignored) {}
            socket.emit("call:reject", payload);
        }
        clearCall(false);
    }

    private void finishIncomingAsMissed(Object[] args) {
        if (ringingCallId == null) return;
        JSONObject payload = firstJson(args);
        if (payload != null) {
            String eventCallId = payload.optString("callId", "");
            if (!eventCallId.isEmpty() && !ringingCallId.equals(eventCallId)) return;
        }
        if (pref("missedCalls", true)) postMissedCall();
        clearCall(false);
    }

    private void postMissedCall() {
        String caller = ringingCallerName == null || ringingCallerName.isEmpty() ? "مستخدم شنو منو" : ringingCallerName;
        Intent openIntent = new Intent(this, MainActivity.class)
            .putExtra("incoming_user", ringingFrom)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(
            this,
            MISSED_NOTIFICATION_BASE + caller.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = builder(CHANNEL_MISSED)
            .setSmallIcon(com.shinomeno.taktak.R.drawable.ic_launcher)
            .setContentTitle("مكالمة فائتة")
            .setContentText(caller)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MISSED_CALL)
            .build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(MISSED_NOTIFICATION_BASE + Math.abs(caller.hashCode() % 500), notification);
    }

    private void postMessageNotification(JSONObject payload) {
        if (!pref("messages", true)) return;
        JSONObject message = payload.optJSONObject("message");
        if (message == null) message = payload;
        String sender = payload.optString("senderName", payload.optString("fromName", "رسالة جديدة"));
        String text = message.optString("text", "لديك رسالة جديدة على شنو منو");
        String userId = payload.optString("from", message.optString("senderId", ""));
        if (!pref("lockScreenPreview", false)) text = "لديك رسالة جديدة على شنو منو";

        Intent openIntent = new Intent(this, MainActivity.class)
            .putExtra("incoming_user", userId)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(
            this,
            MESSAGE_NOTIFICATION_BASE + userId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = builder(CHANNEL_MESSAGES)
            .setSmallIcon(com.shinomeno.taktak.R.drawable.ic_launcher)
            .setContentTitle(sender == null || sender.trim().isEmpty() ? "شنو منو" : sender)
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(pref("lockScreenPreview", false) ? Notification.VISIBILITY_PUBLIC : Notification.VISIBILITY_PRIVATE)
            .build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(MESSAGE_NOTIFICATION_BASE + Math.abs((userId + text).hashCode() % 500), notification);
    }

    private void clearCall(boolean keepMissed) {
        stopRingtone();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(CALL_NOTIFICATION_ID);
        ringingCallId = null;
        ringingCallerName = null;
        ringingFrom = null;
        ringingConversationId = null;
        ringingType = null;
    }

    private boolean pref(String key, boolean fallback) {
        String json = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_NOTIFICATION_PREFS, "{}");
        try { return new JSONObject(json).optBoolean(key, fallback); }
        catch (Exception ignored) { return fallback; }
    }

    private String token() {
        return getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_TOKEN, "");
    }

    private boolean isBackgroundEnabled() {
        return getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_BACKGROUND, false);
    }

    @Override
    public void onDestroy() {
        stopRingtone();
        if (socket != null) {
            socket.off();
            socket.disconnect();
            socket.close();
            socket = null;
        }
        super.onDestroy();
    }

    public static void startIfAllowed(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_BACKGROUND, false)) return;
        if (prefs.getString(KEY_TOKEN, "").isEmpty()) return;
        Intent intent = new Intent(context, BackgroundRealtimeService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, BackgroundRealtimeService.class));
    }
}
