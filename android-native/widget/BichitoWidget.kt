package com.alianapp.bichito

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Android Home Screen Widget para Bichito
 * Muestra el estado del bebé en vivo y accesos directos de registro rápido.
 */
class BichitoWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.bichito_widget)

            // Abrir la app principal al tocar el título o la tarjeta
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingOpen = PendingIntent.getActivity(
                context, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_title, pendingOpen)
            views.setOnClickPendingIntent(R.id.widget_status, pendingOpen)

            // Acceso directo a registrar comida
            val feedIntent = Intent(context, MainActivity::class.java).apply {
                action = "ACTION_LOG_FEEDING"
                data = Uri.parse("bichito://quick-log?type=feeding")
            }
            val pendingFeed = PendingIntent.getActivity(
                context, 1, feedIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_quick_feed, pendingFeed)

            // Acceso directo a registrar siesta
            val sleepIntent = Intent(context, MainActivity::class.java).apply {
                action = "ACTION_LOG_SLEEP"
                data = Uri.parse("bichito://quick-log?type=sleep")
            }
            val pendingSleep = PendingIntent.getActivity(
                context, 2, sleepIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_quick_sleep, pendingSleep)

            // Acceso directo a registrar pañal
            val diaperIntent = Intent(context, MainActivity::class.java).apply {
                action = "ACTION_LOG_DIAPER"
                data = Uri.parse("bichito://quick-log?type=diaper")
            }
            val pendingDiaper = PendingIntent.getActivity(
                context, 3, diaperIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_quick_diaper, pendingDiaper)

            // Actualizar vista del widget
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
