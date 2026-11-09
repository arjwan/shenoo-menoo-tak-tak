package com.shinomeno.taktak;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Opt-in foreground-service polling using the existing HttpOnly WebView session.
 * This is not a replacement for an OS push service after force-stop or doze.
 */
final class CallSignalPoller {
    interface Listener {
        void onIncoming(JSONObject call);
        void onEnded(String callId);
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Listener listener;
    private boolean enabled;
    private long cursor;
    private final Runnable cycle = this::poll;

    CallSignalPoller(Listener listener) {
        this.listener = listener;
    }

    private String getCookie() {
        try {
            String all=CookieManager.getInstance().getCookie("https://shinomino.com/");
            if(all==null)return "";
            for(String part:all.split(";")){
                if(part.trim().startsWith("__Host-shino_session="))return part.trim();
            }
        }catch(Exception ignored){}
        return "";
    }

    private static JSONObject request(String method, String path, String cookie, JSONObject body) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL("https://shinomino.com"+path).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        c.setRequestProperty("Cookie",cookie);
        c.setRequestProperty("Accept","application/json");
        if(body!=null){
            c.setDoOutput(true);
            c.setRequestProperty("Origin","https://shinomino.com");
            c.setRequestProperty("Content-Type","application/json");
            try(OutputStream out=c.getOutputStream()){
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
        }
        try{
            if(c.getResponseCode()!=200 && c.getResponseCode()!=201)return null;
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8))){
                StringBuilder b=new StringBuilder();
                String line;
                while((line=reader.readLine())!=null)b.append(line);
                return new JSONObject(b.toString());
            }
        }finally{c.disconnect();}
    }

    void start(){
        if(enabled)return;
        enabled=true;
        main.post(cycle);
    }

    void stop(){
        enabled=false;
        main.removeCallbacks(cycle);
        executor.shutdownNow();
    }

    void send(String event,String callId,String other,String conversation,String type,String reason){
        String cookie=getCookie();
        if(cookie.isEmpty())return;
        executor.execute(()->{
            try{
                JSONObject b=new JSONObject();
                b.put("event",event);b.put("callId",callId);
                b.put("userId",other);b.put("conversationId",conversation);
                b.put("type",type);b.put("reason",reason);
                request("POST","/api/call-signals",cookie,b);
            }catch(Exception e){Log.w("ShnoCalls","Could not send call signal",e);}
        });
    }

    private void poll(){
        if(!enabled)return;
        String cookie=getCookie();
        if(!cookie.isEmpty()){
            executor.execute(()->{
                try{
                    JSONObject result=request("GET","/api/call-signals?after="+cursor,cookie,null);
                    if(result!=null){
                        JSONArray events=result.optJSONArray("events");
                        if(events!=null){
                            for(int i=0;i<events.length();i++){
                                JSONObject item=events.optJSONObject(i);
                                if(item==null)continue;
                                String kind=item.optString("event"),id=item.optString("callId");
                                if("call:invite".equals(kind)){
                                    JSONObject d=item.optJSONObject("payload");
                                    JSONObject incoming=new JSONObject();
                                    incoming.put("callId",id);
                                    incoming.put("conversationId",item.optString("conversationId"));
                                    incoming.put("from",item.optString("from"));
                                    incoming.put("callerName",item.optString("callerName"));
                                    incoming.put("type",d==null?"audio":d.optString("type","audio"));
                                    main.post(()->listener.onIncoming(incoming));
                                }else if("call:end".equals(kind)||"call:reject".equals(kind)||"call:accept".equals(kind)){
                                    main.post(()->listener.onEnded(id));
                                }
                            }
                        }
                        cursor=result.optLong("cursor",cursor);
                    }
                }catch(Exception e){Log.w("ShnoCalls","Signal polling not available",e);}
            });
        }
        if(enabled)main.postDelayed(cycle,4000);
    }
}
