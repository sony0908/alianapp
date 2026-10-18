# Bichito - Guía para Obtener el APK e Implementar Widgets de Android

Esta guía detalla las 3 formas de obtener el archivo **APK listo para instalar** en cualquier teléfono Android, y cómo funciona la arquitectura de **Widgets de Pantalla de Inicio (AppWidgets)** incluida en el proyecto.

---

## 1. Tres Métodos para Obtener el APK Listo para Instalar

### Método A: Compilación Automática en GitHub (Recomendado - 1 Clic y Gratis)
Ya dejamos configurado el flujo de compilación en `.github/workflows/build-apk.yml` para tu repositorio (`https://github.com/sony0908/alianapp.git`):

1. Sube estos cambios a tu repositorio de GitHub (`git push`).
2. Entra a tu repositorio en GitHub y haz clic en la pestaña **"Actions"**.
3. En la barra lateral izquierda, selecciona el flujo **"Compilar APK Android de Bichito"**.
4. Haz clic en el botón **"Run workflow"** (o se ejecutará solo en cada push).
5. GitHub utilizará sus servidores en la nube con Java 17 y Android SDK para compilar el APK en ~3 minutos.
6. Al finalizar, aparecerá el archivo **`Bichito-Android.apk`** listo para descargar e instalar en tu celular.

---

### Método B: Descarga Inmediata vía PWABuilder (Sin necesidad de compilar)
Bichito ya cuenta con `manifest.webmanifest`, iconos y `service-worker.js` válidos:

1. Ve a [https://www.pwabuilder.com](https://www.pwabuilder.com).
2. Pega la URL de tu aplicación (por ejemplo, `https://alianapp.vercel.app`).
3. Haz clic en **"Package for Android"** (o "Generate APK").
4. Descarga el paquete APK firmado listo para instalar.

---

### Método C: Con Expo CLI / EAS Build (En tu computadora)
Si tienes Node.js en tu máquina:
```bash
# 1. Instalar la herramienta oficial de compilación en la nube de Expo
npm install -g eas-cli

# 2. Entrar a la carpeta del proyecto nativo
cd android-native

# 3. Iniciar sesión y compilar APK directo
eas build -p android --profile preview
```
Al finalizar, la terminal te entregará un enlace directo y un código QR para descargar el `.apk` directamente a tu celular.

---

## 2. Arquitectura de Widgets para la Pantalla de Inicio (Android AppWidgets)

Para que puedas trabajar en los **Widgets de Android**, hemos creado la estructura nativa en `android-native/widget/`:

### Archivos creados:
1. **`android-native/widget/bichito_widget_info.xml`**:
   - Define las dimensiones (4x2 celdas), categoría de pantalla de inicio y tiempo de actualización (`updatePeriodMillis`).

2. **`android-native/widget/bichito_widget.xml`**:
   - Diseño visual del widget con los colores oficiales de Bichito (`#df7446` terracota, `#5e9dcc` azul, fondo `#fff8f2`).
   - Muestra el estado del bebé: **Próxima siesta sugerida**, **Última toma** y tiempo transcurrido.
   - **Botones de acción rápida**:
     - `🍼 Comida`
     - `😴 Siesta`
     - `🚼 Pañal`

3. **`android-native/widget/BichitoWidget.kt`**:
   - Código Kotlin (`AppWidgetProvider`) que gestiona el evento `onUpdate` y los `PendingIntent` para abrir la app o ejecutar acciones de registro rápido al tocar cada botón del widget desde la pantalla de inicio del teléfono.
