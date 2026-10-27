package com.alianapp.bichito

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class BichitoAppWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_QUICK_LOG) {
            val type = intent.getStringExtra("type") ?: "feed"
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("quick_log_type", type)
            }
            context.startActivity(launchIntent)
        }
    }

    companion object {
        const val ACTION_QUICK_LOG = "com.alianapp.bichito.ACTION_QUICK_LOG"

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.bichito_widget)

            // Cargar datos reales
            val nextNap = WidgetDataHelper.getNextNap(context)
            val lastEvent = WidgetDataHelper.getLastEvent(context)
            val updatedAt = WidgetDataHelper.getUpdatedAt(context)

            views.setTextViewText(R.id.widget_next_nap, nextNap)
            views.setTextViewText(R.id.widget_last_event, lastEvent)
            views.setTextViewText(R.id.widget_updated_at, updatedAt)

            // Tocar el cuerpo del widget abre la aplicación
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingOpen = PendingIntent.getActivity(
                context, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_brand, pendingOpen)
            views.setOnClickPendingIntent(R.id.widget_content_card, pendingOpen)

            // Botón rápido Comida
            val feedIntent = Intent(context, BichitoAppWidget::class.java).apply {
                action = ACTION_QUICK_LOG
                putExtra("type", "feed")
            }
            val pendingFeed = PendingIntent.getBroadcast(
                context, 101, feedIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_widget_feed, pendingFeed)

            // Botón rápido Siesta
            val sleepIntent = Intent(context, BichitoAppWidget::class.java).apply {
                action = ACTION_QUICK_LOG
                putExtra("type", "sleep")
            }
            val pendingSleep = PendingIntent.getBroadcast(
                context, 102, sleepIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_widget_sleep, pendingSleep)

            // Botón rápido Pañal
            val diaperIntent = Intent(context, BichitoAppWidget::class.java).apply {
                action = ACTION_QUICK_LOG
                putExtra("type", "diaper")
            }
            val pendingDiaper = PendingIntent.getBroadcast(
                context, 103, diaperIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_widget_diaper, pendingDiaper)

            // Notificar al gestor de widgets
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
