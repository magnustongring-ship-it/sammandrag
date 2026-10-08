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
export type UserRole = "lagadmin" | "foreningsadmin" | "superadmin";
export type EventStatus = "utkast" | "publicerad" | "avbokad";
export type Gender = "pojkar" | "flickor" | "mixed";
export type RegistrationStatus = "anmald" | "vantelista" | "avanmald";
export type RefereeLevel = "matchledare" | "niva1" | "niva2" | "niva3" | "niva4";

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
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          full_name?: string | null;
          role?: UserRole;
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
          level: string | null;
          game_format: string | null;
          periods: number | null;
          period_minutes: number | null;
          break_minutes: number | null;
          court_note: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          sort_order?: number;
          level?: string | null;
          game_format?: string | null;
          periods?: number | null;
          period_minutes?: number | null;
          break_minutes?: number | null;
          court_note?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          sort_order?: number;
          level?: string | null;
          game_format?: string | null;
          periods?: number | null;
          period_minutes?: number | null;
          break_minutes?: number | null;
          court_note?: string | null;
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
          game_format: string | null;
          periods: number | null;
          period_minutes: number | null;
          break_minutes: number | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          age_group_id: number;
          gender: Gender;
          max_teams: number;
          game_format?: string | null;
          periods?: number | null;
          period_minutes?: number | null;
          break_minutes?: number | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          age_group_id?: number;
          gender?: Gender;
          max_teams?: number;
          game_format?: string | null;
          periods?: number | null;
          period_minutes?: number | null;
          break_minutes?: number | null;
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
      event_schedules: {
        Row: {
          event_id: string;
          start_time: string;
          courts: number;
          min_rest_minutes: number;
          game_format: string;
          periods: number;
          period_minutes: number;
          break_minutes: number;
          matchup: "alla" | "antal";
          matches_per_team: number;
          class_settings: Json;
          published: boolean;
          generated_at: string | null;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          start_time: string;
          courts?: number;
          min_rest_minutes?: number;
          game_format?: string;
          periods?: number;
          period_minutes?: number;
          break_minutes?: number;
          matchup?: "alla" | "antal";
          matches_per_team?: number;
          class_settings?: Json;
          published?: boolean;
          generated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          start_time?: string;
          courts?: number;
          min_rest_minutes?: number;
          game_format?: string;
          periods?: number;
          period_minutes?: number;
          break_minutes?: number;
          matchup?: "alla" | "antal";
          matches_per_team?: number;
          class_settings?: Json;
          published?: boolean;
          generated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_schedules_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_matches: {
        Row: {
          id: string;
          event_id: string;
          event_class_id: string;
          court: number;
          starts_at: string;
          ends_at: string;
          game_format: string;
          home_registration_id: string | null;
          away_registration_id: string | null;
          home_team: string;
          home_club: string | null;
          away_team: string;
          away_club: string | null;
          referee1_id: string | null;
          referee1_name: string | null;
          referee2_id: string | null;
          referee2_name: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_class_id: string;
          court: number;
          starts_at: string;
          ends_at: string;
          game_format: string;
          home_registration_id?: string | null;
          away_registration_id?: string | null;
          home_team: string;
          home_club?: string | null;
          away_team: string;
          away_club?: string | null;
          referee1_id?: string | null;
          referee1_name?: string | null;
          referee2_id?: string | null;
          referee2_name?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_class_id?: string;
          court?: number;
          starts_at?: string;
          ends_at?: string;
          game_format?: string;
          home_registration_id?: string | null;
          away_registration_id?: string | null;
          home_team?: string;
          home_club?: string | null;
          away_team?: string;
          away_club?: string | null;
          referee1_id?: string | null;
          referee1_name?: string | null;
          referee2_id?: string | null;
          referee2_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_matches_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedule_matches_event_class_id_fkey";
            columns: ["event_class_id"];
            isOneToOne: false;
            referencedRelation: "event_classes";
            referencedColumns: ["id"];
          },
        ];
      };
      referee_applications: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          email: string;
          phone: string;
          level: RefereeLevel;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          email: string;
          phone: string;
          level: RefereeLevel;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          email?: string;
          phone?: string;
          level?: RefereeLevel;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referee_applications_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      membership_requests: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          status: OrganizationStatus;
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          status?: OrganizationStatus;
          decided_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          status?: OrganizationStatus;
          decided_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membership_requests_organization_id_fkey";
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
      cancel_registration: {
        Args: { p_registration_id: string };
        Returns: undefined;
      };
      move_registration: {
        Args: {
          p_registration_id: string;
          p_class_id: string;
          p_status: string;
          p_team_name: string;
        };
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
      request_membership: { Args: { p_org: string }; Returns: string };
      cancel_membership_request: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      decide_membership: {
        Args: { p_request: string; p_approve: boolean };
        Returns: undefined;
      };
      set_user_role: {
        Args: { p_user: string; p_role: string };
        Returns: undefined;
      };
      set_user_org: {
        Args: { p_user: string; p_org: string | null };
        Returns: undefined;
      };
      list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          organization_id: string | null;
          organization_name: string | null;
          created_at: string;
        }[];
      };
      list_membership_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          organization_id: string;
          organization_name: string;
          created_at: string;
        }[];
      };
      is_event_organizer: { Args: { p_event_id: string }; Returns: boolean };
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
