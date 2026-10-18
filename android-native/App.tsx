import React, { useRef, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  StatusBar, 
  BackHandler, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform 
} from 'react-native';
import { WebView } from 'react-native-webview';

// URL de tu aplicación Bichito desplegada en Vercel o en tu servidor
const APP_URL = 'https://alianapp.vercel.app'; 

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Soporte nativo para el botón físico "Atrás" de Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // Evita salir de la app
        }
        return false; // Sale de la app si está en la página principal
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Barra de estado con el color terracota oficial de Bichito (#df7446) */}
      <StatusBar barStyle="light-content" backgroundColor="#df7446" />
      
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowFileAccess={true}
        allowsBackForwardNavigationGestures={true}
        mixedContentMode="compatibility"
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
        onLoadEnd={() => setIsLoading(false)}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#df7446" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#df7446',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff8f2',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff8f2',
  },
});
