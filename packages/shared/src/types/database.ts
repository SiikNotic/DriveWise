/**
 * Hand-written to match supabase/migrations/*.sql until a real project is
 * linked. Once it exists, regenerate the authoritative version with:
 *   npx supabase gen types typescript --local > packages/shared/src/types/database.ts
 * (or `--project-id <ref>` against the hosted project) and diff before
 * committing — this file must never drift from the migrations.
 */

type Timestamp = string;

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      vehicles: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          nickname: string;
          make: string;
          model: string;
          year: number;
          trim: string | null;
          fuel_type: "gasoline" | "diesel" | "hybrid" | "electric";
          fuel_efficiency_mpg: number;
          fuel_price_usd: number;
          insurance_monthly_cost_usd: number;
          maintenance_cost_per_mile_usd: number;
          depreciation_cost_per_mile_usd: number;
          other_operating_cost_per_mile_usd: number;
          estimated_monthly_miles: number;
          odometer_miles: number | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["vehicles"]["Row"],
          | "id"
          | "trim"
          | "fuel_price_usd"
          | "insurance_monthly_cost_usd"
          | "maintenance_cost_per_mile_usd"
          | "depreciation_cost_per_mile_usd"
          | "other_operating_cost_per_mile_usd"
          | "estimated_monthly_miles"
          | "odometer_miles"
          | "created_at"
          | "updated_at"
        > & {
          id?: string;
          trim?: string | null;
          fuel_price_usd?: number;
          insurance_monthly_cost_usd?: number;
          maintenance_cost_per_mile_usd?: number;
          depreciation_cost_per_mile_usd?: number;
          other_operating_cost_per_mile_usd?: number;
          estimated_monthly_miles?: number;
          odometer_miles?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          language: "en" | "es";
          distance_unit: "mi" | "km";
          default_vehicle_id: string | null;
          standard_mileage_rate_usd: number;
          updated_at: Timestamp;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["user_settings"]["Row"], "user_id">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          country: string | null;
          state: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["profiles"]["Row"], "user_id">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          vehicle_id: string | null;
          platform:
            | "doordash"
            | "uber_eats"
            | "grubhub"
            | "instacart"
            | "other"
            | null;
          purpose: "business" | "personal" | "commute";
          source: "gps_auto" | "manual";
          started_at: Timestamp;
          ended_at: Timestamp | null;
          start_latitude: number | null;
          start_longitude: number | null;
          end_latitude: number | null;
          end_longitude: number | null;
          route_simplified: { latitude: number; longitude: number }[] | null;
          distance_miles: number;
          duration_seconds: number;
          earnings_usd: number | null;
          tips_usd: number | null;
          notes: string | null;
          status: "tracking" | "paused" | "completed";
          sync_status: "pending_sync" | "synced" | "sync_error";
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["trips"]["Row"],
          | "id"
          | "purpose"
          | "source"
          | "distance_miles"
          | "duration_seconds"
          | "status"
          | "sync_status"
          | "created_at"
          | "updated_at"
        > & {
          id?: string;
          purpose?: Database["public"]["Tables"]["trips"]["Row"]["purpose"];
          source?: Database["public"]["Tables"]["trips"]["Row"]["source"];
          distance_miles?: number;
          duration_seconds?: number;
          status?: Database["public"]["Tables"]["trips"]["Row"]["status"];
          sync_status?: Database["public"]["Tables"]["trips"]["Row"]["sync_status"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [];
      };
      trip_points: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string;
          client_id: string;
          latitude: number;
          longitude: number;
          altitude_meters: number | null;
          speed_mps: number | null;
          horizontal_accuracy_meters: number | null;
          recorded_at: Timestamp;
          sequence: number;
        };
        Insert: Omit<Database["public"]["Tables"]["trip_points"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_points"]["Insert"]>;
        Relationships: [];
      };
      delivery_offers: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          vehicle_id: string | null;
          platform: "doordash" | "uber_eats" | "grubhub" | "instacart" | "other";
          offered_pay_usd: number;
          estimated_distance_miles: number;
          estimated_duration_minutes: number;
          estimated_return_distance_miles: number | null;
          decision: "accepted" | "declined" | "expired";
          linked_trip_id: string | null;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["delivery_offers"]["Row"],
          "id" | "decision" | "created_at"
        > & {
          id?: string;
          decision?: Database["public"]["Tables"]["delivery_offers"]["Row"]["decision"];
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["delivery_offers"]["Insert"]>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          vehicle_id: string | null;
          category:
            | "fuel"
            | "maintenance"
            | "insurance"
            | "vehicle_payment"
            | "phone_plan"
            | "supplies"
            | "parking_tolls"
            | "other";
          amount_usd: number;
          incurred_on: string;
          description: string | null;
          receipt_storage_path: string | null;
          is_tax_deductible: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["expenses"]["Row"],
          "id" | "is_tax_deductible" | "created_at" | "updated_at"
        > & {
          id?: string;
          is_tax_deductible?: boolean;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [];
      };
    };
  };
}
