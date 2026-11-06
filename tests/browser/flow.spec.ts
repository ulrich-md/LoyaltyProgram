import { test, expect } from "@playwright/test";
test("web registration, confirmed stamp, live card, admin and cashier permissions", async ({
  browser,
}) => {
  const client = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const card = await client.newPage();
  const email = `browser-${Date.now()}@example.test`;
  await card.goto("/registro/bruma");
  await card.getByLabel("Tu nombre").fill("Cliente Navegador");
  await card.getByLabel("Correo electrónico").fill(email);
  await card.getByLabel("Acepto las condiciones").check();
  await card.getByRole("button", { name: "Crear mi tarjeta" }).click();
  await expect(card).toHaveURL(/\/tarjeta\//);
  await expect(card.getByText("0 / 8 sellos")).toBeVisible();
  await expect(card.getByAltText("Código QR")).toBeVisible();
  const staff = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await staff.newPage();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@demo.local");
  await page.getByLabel("Contraseña").fill("demostracion-local-2026");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("heading", { name: "Así va tu comunidad" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Caja y escáner", exact: true })
    .click();
  await page.getByLabel("Buscar cliente en caja").fill(email);
  await page
    .getByRole("button", { name: new RegExp("Cliente Navegador") })
    .click();
  await page
    .getByRole("button", { name: "Confirmar compra y agregar sello" })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Sello agregado. ¡Gracias por volver!"),
  ).toBeVisible();
  await card.reload();
  await expect(card.getByText("1 / 8 sellos")).toBeVisible();
  await card.screenshot({
    path: "test-results/card-mobile.png",
    fullPage: true,
  });
  // Complete this same customer's cycle with authenticated, confirmed API operations.
  const current = await staff.request.get(
    "/api/business/10000000-0000-4000-8000-000000000001",
  );
  const payload = await current.json();
  const c = payload.customers.find((x: { email: string }) => x.email === email);
  for (let i = 0; i < 7; i++) {
    const r = await staff.request.post("/api/operation", {
      headers: { origin: "http://localhost:3000" },
      data: {
        business: payload.business.id,
        scan: c.scan_token,
        kind: "stamp",
        key: crypto.randomUUID(),
      },
    });
    expect(r.ok()).toBeTruthy();
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Caja y escáner", exact: true })
    .click();
  await page.getByLabel("Buscar cliente en caja").fill(email);
  await page
    .getByRole("button", { name: new RegExp("Cliente Navegador") })
    .click();
  await page.getByRole("button", { name: "Canjear recompensa" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Recompensa canjeada.", { exact: true }),
  ).toBeVisible();
  await card.reload();
  await expect(card.getByText("0 / 8 sellos")).toBeVisible();
  await expect(
    card.getByText("Recompensa canjeada", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mi programa", exact: true }).click();
  await expect(page.getByLabel("Nombre comercial")).toHaveValue("Bruma Café");
  const till = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const cashier = await till.newPage();
  await cashier.goto("/login");
  await cashier.getByLabel("Correo electrónico").fill("caja@demo.local");
  await cashier.getByLabel("Contraseña").fill("demostracion-local-2026");
  await cashier.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    cashier.getByRole("heading", { name: "Cada visita cuenta" }),
  ).toBeVisible();
  await expect(
    cashier.getByRole("button", { name: "Mi programa", exact: true }),
  ).toHaveCount(0);
  const denied = await till.request.get(
    "/api/export/10000000-0000-4000-8000-000000000001",
  );
  expect(denied.status()).toBe(403);
  await cashier.getByRole("button", { name: "Abrir cámara" }).click();
  await expect(cashier.getByRole("alert")).toBeVisible({ timeout: 15000 });
  await cashier.screenshot({
    path: "test-results/cashier-mobile.png",
    fullPage: true,
  });
  await client.close();
  await staff.close();
  await till.close();
});
test("anonymous mutation and cross-origin mutation are rejected", async ({
  request,
}) => {
  const r = await request.post("/api/operation", {
    headers: { origin: "http://localhost:3000" },
    data: {},
  });
  expect(r.status()).toBe(401);
  const cross = await request.post("/api/register", {
    headers: { origin: "https://untrusted.example" },
    data: {},
  });
  expect(cross.status()).toBe(403);
});
