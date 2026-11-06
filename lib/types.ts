export type Business = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  color: string;
  program: string;
  goal: number;
  reward: string;
  terms: string;
  privacy: string;
  status: "draft" | "active" | "suspended";
  provider: "web" | "pass_studio";
  template_id: string;
};
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  scan_token: string;
  stamps: number;
  cycle_goal: number;
  cycle_reward: string;
  cycle_terms: string;
  created_at: string;
};
export type Reward = {
  id: string;
  customer_id: string;
  description: string;
  terms: string;
  state: string;
  created_at: string;
};
export type Movement = {
  id: string;
  customer_id: string;
  kind: string;
  reward_id: string | null;
  reverses: string | null;
  reason: string;
  created_at: string;
  employee_id: string;
};
export type Card = {
  provider: string;
  status: string;
  distribution_url: string | null;
  synced_at: string | null;
  customer_id: string;
  last_error: string | null;
};
export type StaffData = {
  business: Business;
  customers: Customer[];
  rewards: Reward[];
  movements: Movement[];
  wallet: Card[];
  employees: { email: string; role: string; user_id: string }[];
  operations: {
    kind: string;
    estimated_units: number;
    status: string;
    created_at: string;
  }[];
};
export type Me = {
  platform: boolean;
  metrics?: {
    businesses: number;
    active: number;
    customers: number;
    stamps: number;
  };
  businesses: Business[];
  memberships: { business_id: string; role: string }[];
};
