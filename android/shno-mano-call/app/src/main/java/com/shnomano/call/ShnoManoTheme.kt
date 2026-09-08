package com.shnomano.call

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ShnoDarkColors = darkColorScheme(
    primary = Color(0xFF8B75FF),
    onPrimary = Color.White,
    secondary = Color(0xFF27D8C4),
    onSecondary = Color(0xFF001F1A),
    background = Color(0xFF070910),
    onBackground = Color(0xFFF7F8FC),
    surface = Color(0xFF111522),
    onSurface = Color(0xFFF7F8FC),
    surfaceVariant = Color(0xFF171C2A),
    onSurfaceVariant = Color(0xFFD6DAE5),
    outline = Color(0xFF3A4258),
    error = Color(0xFFFF6B7A),
    onError = Color.White
)

@Composable
fun ShnoManoTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ShnoDarkColors, content = content)
}
