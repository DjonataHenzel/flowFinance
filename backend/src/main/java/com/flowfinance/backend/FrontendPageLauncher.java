package com.flowfinance.backend;

import java.awt.Desktop;
import java.net.URI;

public class FrontendPageLauncher {

    public static void openPage(String url) {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(new URI(url));
            } else {
                System.out.println("Navegador não suportado neste ambiente.");
            }
        } catch (Exception e) {
            System.err.println("Erro ao abrir a página: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        openPage("http://localhost:5173");
    }
}
