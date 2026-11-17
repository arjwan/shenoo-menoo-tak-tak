package com.shnomano.call

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val ShnoDarkColors = darkColorScheme(
    primary = Color(0xFF54DFCF),
    onPrimary = Color(0xFF092325),
    secondary = Color(0xFF9BA7FF),
    onSecondary = Color(0xFF001F1A),
    background = Color(0xFF0B1020),
    onBackground = Color(0xFFF7F8FC),
    surface = Color(0xFF151E32),
    onSurface = Color(0xFFF7F8FC),
    surfaceVariant = Color(0xFF1C2941),
    onSurfaceVariant = Color(0xFFD6DAE5),
    outline = Color(0xFF3A4258),
    error = Color(0xFFFF6B7A),
    onError = Color.White
)

private val ShnoLightColors = lightColorScheme(
    primary = Color(0xFF6244C8), onPrimary = Color.White,
    secondary = Color(0xFF087D72), background = Color(0xFFF6F7FC),
    onBackground = Color(0xFF192238), surface = Color.White,
    onSurface = Color(0xFF192238), surfaceVariant = Color(0xFFEBEEF8),
    onSurfaceVariant = Color(0xFF526078), outline = Color(0xFF9AA4BA)
)

@Composable
fun ShnoManoTheme(darkTheme: Boolean? = null, content: @Composable () -> Unit) {
    androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Rtl) {
        MaterialTheme(colorScheme = if (darkTheme ?: SettingsStore(LocalContext.current).darkTheme) ShnoDarkColors else ShnoLightColors, shapes = androidx.compose.material3.Shapes(
            small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
            medium = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
            large = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
        ), content = content)
    }
}
