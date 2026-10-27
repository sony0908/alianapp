# Bichito - Aplicación Nativa para Android con Soporte de Widgets

Este repositorio incluye ahora un **proyecto nativo Android completo** en la carpeta `/android`, configurado con SDK 34, Material 3 y **Widgets para la Pantalla de Inicio (AppWidgets)** para Android.

---

## 📱 ¿Qué incluye la versión nativa de Android?

1. **Widget de Pantalla de Inicio (`BichitoAppWidget`)**:
   - Muestra la próxima siesta calculada y el último registro del bebé en vivo.
   - Botones rápidos en el escritorio del celular:
     - `🍼 Comida`: Abre la app directamente para registrar alimentación.
     - `😴 Siesta`: Inicia o finaliza la siesta con un toque.
     - `🚼 Pañal`: Registra cambio de pañal.
   - Se actualiza automáticamente cuando registras algo dentro de la app mediante `AndroidBridge`.

2. **Aplicación Nativa con WebView (`MainActivity`)**:
   - Carga la interfaz oficial de Bichito con el tema terracota (`#df7446`).
   - Soporte para el botón físico "Atrás" de Android.
   - Gesto de deslizar hacia abajo para actualizar (*Swipe-to-Refresh*).
   - Acceso a enlaces de teléfono (`tel:`) y WhatsApp de urgencia.

---

## 🛠️ Cómo abrirlo y compilar el APK en Android Studio

1. Abre **Android Studio** en tu computadora.
2. Selecciona **"Open"** y elige la carpeta **`/android`** de este proyecto.
3. Espera a que Gradle sincronice las dependencias.
4. Para generar el APK listo para instalar:
   - Ve al menú superior: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - En 1 minuto Android Studio te mostrará un mensaje: *"APK(s) generated successfully"* con un botón **"locate"** para abrir el archivo `.apk` y pasarlo a tu celular.
5. Para probarlo en el emulador o tu celular conectado por USB:
   - Haz clic en el botón verde **▶ (Run)**.

---

## 🚀 Compilación Automática en GitHub Actions

El archivo `.github/workflows/build-apk.yml` está configurado para compilar el APK de forma automática:
- En tu repositorio de GitHub, entra a la pestaña **Actions**.
- Selecciona **"Compilar APK Nativo Android con Widgets"** y presiona **"Run workflow"**.
- Descarga el archivo generado **`Bichito-Widgets-Android.apk`**.
