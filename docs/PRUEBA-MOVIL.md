# Prueba desde iPhone y Android

## Disponible ahora: tarjeta web

1. Desplegar con Supabase propio, usuarios reales de demo y HTTPS. Configurar `APP_URL`, red y credenciales; comprobar acceso de administrador y cajero. No exponer el login local compartido.
2. En panel del negocio descargar el QR de registro. Abrir esa URL en Safari de iPhone y Chrome de Android. La misma URL se puede grabar en una etiqueta NFC que solo abre la web.
3. Registrar dos correos de prueba distintos, aceptar condiciones y dejar marketing desmarcado. Conservar los enlaces privados. Comprobar la tarjeta, QR y meta.
4. Desde el móvil del cajero abrir la caja, permitir cámara y escanear el QR del cliente. Confirmar compra; comprobar un único movimiento, actualización de la tarjeta web y ausencia de llamadas externas al escanear. Si no se permite cámara, usar búsqueda por correo/teléfono.
5. Repetir hasta completar 8: comprobar un premio y nuevo ciclo en cero. Canjear y comprobar el historial. Intentar el mismo canje de nuevo: no debe estar disponible.
6. Comprobar recuperación por correo en el mismo navegador, acceso entre negocios denegado y que el cajero no puede configurar/exportar. No se ha probado SMTP ni teléfonos físicos en el entorno actual.

## Wallet real: después de completar PASS-STUDIO.md

No ejecutar este procedimiento antes de verificar contrato, certificados, tarifas y credenciales.

1. Para ahorrar llamadas, registrar los dos clientes de prueba y darles **7 sellos web antes de emitir**. Confirmar 0 pases externos antes de la solicitud. Esos movimientos no deben consumir créditos.
2. El cliente de iPhone solicita explícitamente su pase, agrega a Apple Wallet y presenta el QR al cajero. Comprobar que un doble clic reutiliza la instancia. Es una emisión.
3. Registrar el octavo sello en nuestra caja, comprobar recompensa y actualización real en Wallet. Canjear el premio y comprobar la segunda actualización. Nuestra base conserva el historial y el nuevo ciclo. No usar el endpoint/escáner de canje del proveedor.
4. Repetir en Android/Google Wallet con el segundo cliente: otra emisión y dos actualizaciones.
5. Total previsto: **2 emisiones + 4 actualizaciones**; tarifa en créditos pendiente de documentación. Conservar evidencia y consumo real del proveedor por separado del contador local. No afirmar instalación basándose en una emisión.
6. Simular agotamiento del tope local (sin gastar el saldo externo): el movimiento web se conserva, Wallet queda pendiente y no hay reintento infinito. Restaurar tope y reintentar una vez desde el futuro control administrativo verificado.

Si ambos dispositivos deben usar el mismo titular, verificar primero si una única instancia soporta ambas plataformas y cómo factura el proveedor. Este comportamiento todavía no está confirmado; no asumirlo para el presupuesto.
