export type WalletState = {
  customerId: string;
  version: number;
  name: string;
  stamps: number;
  goal: number;
  reward: string;
  availableRewards: number;
  scanToken: string;
  templateId: string;
};
export type IssuedPass = {
  passId: string;
  instanceId: string;
  distributionUrl: string;
};
export interface WalletProvider {
  readonly name: string;
  issue(state: WalletState, idempotencyKey: string): Promise<IssuedPass>;
  getDistributionLink(pass: IssuedPass): Promise<string>;
  update(
    pass: IssuedPass,
    state: WalletState,
    idempotencyKey: string,
  ): Promise<void>;
  status(pass: IssuedPass): Promise<{ installed: boolean | null }>;
  revoke(pass: IssuedPass): Promise<void>;
}
export class WalletError extends Error {
  constructor(
    message: string,
    readonly category: "temporary" | "credits" | "configuration" | "uncertain",
  ) {
    super(message);
  }
}
export class WebWalletProvider implements WalletProvider {
  readonly name = "web";
  constructor(private origin: string) {}
  async issue(s: WalletState) {
    return {
      passId: s.customerId,
      instanceId: s.customerId,
      distributionUrl: this.origin,
    };
  }
  async getDistributionLink(p: IssuedPass) {
    return p.distributionUrl;
  }
  async update() {}
  async status() {
    return { installed: null };
  }
  async revoke() {
    throw new WalletError(
      "La tarjeta web se controla desde el programa",
      "configuration",
    );
  }
}
/** Transport must be implemented against VERIFIED official documentation, never guessed. */
export interface PassStudioTransport {
  issue(s: WalletState, key: string): Promise<IssuedPass>;
  update(p: IssuedPass, s: WalletState, key: string): Promise<void>;
}
export class PassStudioWalletProvider implements WalletProvider {
  readonly name = "pass_studio";
  constructor(private transport?: PassStudioTransport) {}
  async issue(s: WalletState, key: string) {
    if (!this.transport)
      throw new WalletError(
        "Documentación y transporte oficial pendientes de verificación",
        "configuration",
      );
    return this.transport.issue(s, key);
  }
  async getDistributionLink(p: IssuedPass) {
    return p.distributionUrl;
  }
  async update(p: IssuedPass, s: WalletState, key: string) {
    if (!this.transport)
      throw new WalletError(
        "Transporte oficial no configurado",
        "configuration",
      );
    await this.transport.update(p, s, key);
  }
  async status() {
    return { installed: null };
  }
  async revoke() {
    throw new WalletError(
      "Revocación no verificada en la API oficial",
      "configuration",
    );
  }
}
export const futureProviders = {
  apple_direct: {
    available: false,
    reason: "Requiere Apple Developer, certificados y adaptador",
  },
  google_direct: {
    available: false,
    reason: "Requiere cuenta de emisor y adaptador",
  },
} as const;
export function providerForCard(name: string, providers: WalletProvider[]) {
  const p = providers.find((p) => p.name === name);
  if (!p)
    throw new WalletError("Proveedor original no disponible", "configuration");
  return p;
}
export function retryPolicy(error: WalletError, attempts: number) {
  return error.category === "temporary" && attempts < 4
    ? { status: "pending", delaySeconds: Math.min(3600, 30 * 2 ** attempts) }
    : { status: "blocked", delaySeconds: 0 };
}
