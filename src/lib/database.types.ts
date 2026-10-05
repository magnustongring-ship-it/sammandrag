// Typer för databasschemat i SPEC.md avsnitt 8.
// Skrivna för hand i samma format som `supabase gen types typescript`.
// Uppdatera här när schemat ändras (eller ersätt med genererade typer).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationStatus = "vantar" | "godkand" | "avslagen";
export type EventStatus = "utkast" | "publicerad" | "avbokad";
export type Gender = "pojkar" | "flickor" | "mixed";
export type RegistrationStatus = "anmald" | "vantelista" | "avanmald";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          city: string | null;
          contact_email: string | null;
          status: OrganizationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city?: string | null;
          contact_email?: string | null;
          status?: OrganizationStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string | null;
          contact_email?: string | null;
          status?: OrganizationStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          full_name: string | null;
          is_org_admin: boolean;
          is_site_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          full_name?: string | null;
          is_org_admin?: boolean;
          is_site_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          full_name?: string | null;
          is_org_admin?: boolean;
          is_site_admin?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      age_groups: {
        Row: {
          id: number;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: number;
          name: string;
          sort_order?: number;
        };
        Update: {
          id?: number;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          organizer_org_id: string;
          created_by: string;
          title: string;
          event_date: string;
          start_time: string | null;
          end_time: string | null;
          venue_name: string;
          address: string | null;
          city: string | null;
          description: string | null;
          registration_deadline: string | null;
          status: EventStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organizer_org_id: string;
          created_by: string;
          title: string;
          event_date: string;
          start_time?: string | null;
          end_time?: string | null;
          venue_name: string;
          address?: string | null;
          city?: string | null;
          description?: string | null;
          registration_deadline?: string | null;
          status?: EventStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          organizer_org_id?: string;
          created_by?: string;
          title?: string;
          event_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          venue_name?: string;
          address?: string | null;
          city?: string | null;
          description?: string | null;
          registration_deadline?: string | null;
          status?: EventStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_organizer_org_id_fkey";
            columns: ["organizer_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      event_classes: {
        Row: {
          id: string;
          event_id: string;
          age_group_id: number;
          gender: Gender;
          max_teams: number;
        };
        Insert: {
          id?: string;
          event_id: string;
          age_group_id: number;
          gender: Gender;
          max_teams: number;
        };
        Update: {
          id?: string;
          event_id?: string;
          age_group_id?: number;
          gender?: Gender;
          max_teams?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_classes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_classes_age_group_id_fkey";
            columns: ["age_group_id"];
            isOneToOne: false;
            referencedRelation: "age_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      registrations: {
        Row: {
          id: string;
          event_class_id: string;
          organization_id: string;
          registered_by: string;
          team_name: string;
          contact_email: string;
          contact_phone: string;
          status: RegistrationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_class_id: string;
          organization_id: string;
          registered_by: string;
          team_name: string;
          contact_email: string;
          contact_phone: string;
          status?: RegistrationStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_class_id?: string;
          organization_id?: string;
          registered_by?: string;
          team_name?: string;
          contact_email?: string;
          contact_phone?: string;
          status?: RegistrationStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_event_class_id_fkey";
            columns: ["event_class_id"];
            isOneToOne: false;
            referencedRelation: "event_classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_organization: {
        Args: { p_name: string; p_city: string; p_contact_email: string };
        Returns: string;
      };
      event_class_counts: {
        Args: { p_event_ids: string[] };
        Returns: {
          event_class_id: string;
          registered: number;
          waitlisted: number;
        }[];
      };
      my_org: { Args: Record<PropertyKey, never>; Returns: string };
      is_my_org_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_site_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_my_org_approved: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicTables = Database["public"]["Tables"];

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> =
  PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> =
  PublicTables[T]["Update"];
