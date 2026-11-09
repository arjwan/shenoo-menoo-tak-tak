package com.shnomano.call

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ShnoDarkColors = darkColorScheme(
    primary = Color(0xFF7C5CFF),
    onPrimary = Color.White,
    secondary = Color(0xFF2C9AE9),
    onSecondary = Color(0xFF05142C),
    background = Color(0xFF071529),
    onBackground = Color(0xFFF7F8FC),
    surface = Color(0xFF102443),
    onSurface = Color(0xFFF7F8FC),
    surfaceVariant = Color(0xFF172D51),
    onSurfaceVariant = Color(0xFFD6DAE5),
    outline = Color(0xFF35547A),
    error = Color(0xFFFF6B7A),
    onError = Color.White
)

@Composable
fun ShnoManoTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ShnoDarkColors, content = content)
}
