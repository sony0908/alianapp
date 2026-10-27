package com.alianapp.bichito

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences

object WidgetDataHelper {
    private const val PREFS_NAME = "bichito_widget_prefs"
    private const val KEY_NEXT_NAP = "next_nap"
    private const val KEY_LAST_EVENT = "last_event"
    private const val KEY_UPDATED_AT = "updated_at"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun saveWidgetData(context: Context, nextNap: String, lastEvent: String, updatedAt: String) {
        getPrefs(context).edit().apply {
            putString(KEY_NEXT_NAP, nextNap)
            putString(KEY_LAST_EVENT, lastEvent)
            putString(KEY_UPDATED_AT, updatedAt)
            apply()
        }

        // Notificar al widget para que se actualice de inmediato en la pantalla de inicio
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val componentName = ComponentName(context, BichitoAppWidget::class.java)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
        for (appWidgetId in appWidgetIds) {
            BichitoAppWidget.updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    fun getNextNap(context: Context): String {
        return getPrefs(context).getString(KEY_NEXT_NAP, "Próxima siesta: ~15:30") ?: "Próxima siesta: ~15:30"
    }

    fun getLastEvent(context: Context): String {
        return getPrefs(context).getString(KEY_LAST_EVENT, "Último registro: Biberón") ?: "Último registro: Biberón"
    }

    fun getUpdatedAt(context: Context): String {
        return getPrefs(context).getString(KEY_UPDATED_AT, "Hoy") ?: "Hoy"
    }
}
