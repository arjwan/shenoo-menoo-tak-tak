# Keep Retrofit annotations and generic signatures used by Gson/Retrofit.
-keepattributes Signature
-keepattributes *Annotation*

# DTOs are serialized by Gson through Retrofit.
-keep class com.shnomano.call.data.** { *; }

# Room generates implementation classes at build time.
-keep class * extends androidx.room.RoomDatabase { *; }
