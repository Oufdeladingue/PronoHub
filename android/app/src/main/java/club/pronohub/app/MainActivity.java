package club.pronohub.app;

import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

// Import des plugins Capacitor
import com.capacitorjs.plugins.statusbar.StatusBarPlugin;
import com.capacitorjs.plugins.preferences.PreferencesPlugin;
import com.capacitorjs.plugins.app.AppPlugin;
import com.capacitorjs.plugins.browser.BrowserPlugin;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Enregistrer les plugins avant super.onCreate()
        registerPlugin(StatusBarPlugin.class);
        registerPlugin(PreferencesPlugin.class);
        registerPlugin(AppPlugin.class);
        registerPlugin(BrowserPlugin.class);
        registerPlugin(PushNotificationsPlugin.class);
        registerPlugin(GoogleAuth.class);

        super.onCreate(savedInstanceState);

        // Forcer le background du WebView en noir pour éviter les flashs blancs
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(Color.parseColor("#0a0a0a"));
        }

        // Forcer la status bar et navigation bar en noir (cohérent avec toute l'app)
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        // Icônes claires sur fond sombre
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);
        window.getDecorView().setBackgroundColor(Color.parseColor("#000000"));

        // Créer le canal de notification pour Android 8.0+
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Supprimer l'ancien canal si existant
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.deleteNotificationChannel("pronohub_default");
            }

            CharSequence name = "PronoHub Football";
            String description = "Notifications de PronoHub Football";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(
                "pronohub_notifications",
                name,
                importance
            );
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.enableLights(true);

            // Son personnalisé
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification_sound");
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(soundUri, audioAttributes);

            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
