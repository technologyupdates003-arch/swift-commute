export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          company_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number
          commission_amount: number
          company_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          discount_id: string | null
          id: string
          passenger_id_number: string | null
          passenger_name: string
          passenger_phone: string
          seat_class: Database["public"]["Enums"]["seat_class"] | null
          seat_id: string | null
          seat_number: number
          status: Database["public"]["Enums"]["booking_status"]
          ticket_code: string
          trip_id: string
        }
        Insert: {
          amount: number
          commission_amount?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_id?: string | null
          id?: string
          passenger_id_number?: string | null
          passenger_name: string
          passenger_phone: string
          seat_class?: Database["public"]["Enums"]["seat_class"] | null
          seat_id?: string | null
          seat_number: number
          status?: Database["public"]["Enums"]["booking_status"]
          ticket_code?: string
          trip_id: string
        }
        Update: {
          amount?: number
          commission_amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_id?: string | null
          id?: string
          passenger_id_number?: string | null
          passenger_name?: string
          passenger_phone?: string
          seat_class?: Database["public"]["Enums"]["seat_class"] | null
          seat_id?: string | null
          seat_number?: number
          status?: Database["public"]["Enums"]["booking_status"]
          ticket_code?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          town: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          town: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          town?: string
          updated_at?: string
        }
        Relationships: []
      }
      buses: {
        Row: {
          bus_type: Database["public"]["Enums"]["bus_type"]
          capacity: number
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          plate_number: string
        }
        Insert: {
          bus_type?: Database["public"]["Enums"]["bus_type"]
          capacity: number
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          plate_number: string
        }
        Update: {
          bus_type?: Database["public"]["Enums"]["bus_type"]
          capacity?: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          plate_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          commission_pct: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          commission_pct?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          commission_pct?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_mpesa_settings: {
        Row: {
          business_shortcode: string | null
          callback_url: string | null
          company_id: string
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string
          environment: string
          id: string
          is_enabled: boolean
          party_b: string | null
          passkey: string | null
          updated_at: string
        }
        Insert: {
          business_shortcode?: string | null
          callback_url?: string | null
          company_id: string
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_enabled?: boolean
          party_b?: string | null
          passkey?: string | null
          updated_at?: string
        }
        Update: {
          business_shortcode?: string | null
          callback_url?: string | null
          company_id?: string
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_enabled?: boolean
          party_b?: string | null
          passkey?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      parcel_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          location: string | null
          note: string | null
          parcel_id: string
          status: Database["public"]["Enums"]["parcel_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          note?: string | null
          parcel_id: string
          status: Database["public"]["Enums"]["parcel_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          note?: string | null
          parcel_id?: string
          status?: Database["public"]["Enums"]["parcel_status"]
        }
        Relationships: [
          {
            foreignKeyName: "parcel_movements_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          mpesa_code: string | null
          parcel_id: string
          status: Database["public"]["Enums"]["parcel_payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mpesa_code?: string | null
          parcel_id: string
          status?: Database["public"]["Enums"]["parcel_payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mpesa_code?: string | null
          parcel_id?: string
          status?: Database["public"]["Enums"]["parcel_payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "parcel_payments_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          declared_value: number | null
          description: string
          destination_branch_id: string | null
          id: string
          is_urgent: boolean
          origin_branch_id: string | null
          payment_status: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp: string
          price: number
          quantity: number
          receiver_name: string
          receiver_phone: string
          route_id: string
          sender_id_number: string | null
          sender_name: string
          sender_phone: string
          status: Database["public"]["Enums"]["parcel_status"]
          tracking_id: string
          trip_id: string | null
          updated_at: string
          weight_kg: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          declared_value?: number | null
          description: string
          destination_branch_id?: string | null
          id?: string
          is_urgent?: boolean
          origin_branch_id?: string | null
          payment_status?: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp: string
          price?: number
          quantity?: number
          receiver_name: string
          receiver_phone: string
          route_id: string
          sender_id_number?: string | null
          sender_name: string
          sender_phone: string
          status?: Database["public"]["Enums"]["parcel_status"]
          tracking_id: string
          trip_id?: string | null
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          declared_value?: number | null
          description?: string
          destination_branch_id?: string | null
          id?: string
          is_urgent?: boolean
          origin_branch_id?: string | null
          payment_status?: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp?: string
          price?: number
          quantity?: number
          receiver_name?: string
          receiver_phone?: string
          route_id?: string
          sender_id_number?: string | null
          sender_name?: string
          sender_phone?: string
          status?: Database["public"]["Enums"]["parcel_status"]
          tracking_id?: string
          trip_id?: string | null
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
      platform_wallet_balance: {
        Row: {
          balance: number
          id: string
          total_credited: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          total_credited?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          total_credited?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_wallet_transactions: {
        Row: {
          commission_amount: number
          commission_pct: number
          company_id: string | null
          created_at: string
          gross_amount: number
          id: string
          source_id: string
          source_type: string
        }
        Insert: {
          commission_amount?: number
          commission_pct?: number
          company_id?: string | null
          created_at?: string
          gross_amount?: number
          id?: string
          source_id: string
          source_type: string
        }
        Update: {
          commission_amount?: number
          commission_pct?: number
          company_id?: string | null
          created_at?: string
          gross_amount?: number
          id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          national_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      route_parcel_pricing: {
        Row: {
          base_fee: number
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          per_kg: number
          route_id: string
          updated_at: string
          urgent_surcharge: number
        }
        Insert: {
          base_fee?: number
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          per_kg?: number
          route_id: string
          updated_at?: string
          urgent_surcharge?: number
        }
        Update: {
          base_fee?: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          per_kg?: number
          route_id?: string
          updated_at?: string
          urgent_surcharge?: number
        }
        Relationships: []
      }
      routes: {
        Row: {
          base_price: number
          company_id: string
          created_at: string
          destination: string
          id: string
          is_active: boolean
          origin: string
        }
        Insert: {
          base_price: number
          company_id: string
          created_at?: string
          destination: string
          id?: string
          is_active?: boolean
          origin: string
        }
        Update: {
          base_price?: number
          company_id?: string
          created_at?: string
          destination?: string
          id?: string
          is_active?: boolean
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_locks: {
        Row: {
          created_at: string
          id: string
          lock_expires_at: string
          locked_by_session: string | null
          locked_by_user: string | null
          seat_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lock_expires_at: string
          locked_by_session?: string | null
          locked_by_user?: string | null
          seat_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lock_expires_at?: string
          locked_by_session?: string | null
          locked_by_user?: string | null
          seat_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_locks_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_locks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          bus_id: string
          class: Database["public"]["Enums"]["seat_class"]
          col_index: number
          created_at: string
          id: string
          is_active: boolean
          price_multiplier: number
          row_index: number
          seat_number: string
        }
        Insert: {
          bus_id: string
          class?: Database["public"]["Enums"]["seat_class"]
          col_index: number
          created_at?: string
          id?: string
          is_active?: boolean
          price_multiplier?: number
          row_index: number
          seat_number: string
        }
        Update: {
          bus_id?: string
          class?: Database["public"]["Enums"]["seat_class"]
          col_index?: number
          created_at?: string
          id?: string
          is_active?: boolean
          price_multiplier?: number
          row_index?: number
          seat_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          bus_id: string
          company_id: string
          created_at: string
          departure_at: string
          id: string
          price: number
          route_id: string
          status: Database["public"]["Enums"]["trip_status"]
        }
        Insert: {
          bus_id: string
          company_id: string
          created_at?: string
          departure_at: string
          id?: string
          price: number
          route_id: string
          status?: Database["public"]["Enums"]["trip_status"]
        }
        Update: {
          bus_id?: string
          company_id?: string
          created_at?: string
          departure_at?: string
          id?: string
          price?: number
          route_id?: string
          status?: Database["public"]["Enums"]["trip_status"]
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_booking_payment: {
        Args: { _booking_id: string; _session_token: string }
        Returns: {
          amount: number
          commission_amount: number
          company_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          discount_id: string | null
          id: string
          passenger_id_number: string | null
          passenger_name: string
          passenger_phone: string
          seat_class: Database["public"]["Enums"]["seat_class"] | null
          seat_id: string | null
          seat_number: number
          status: Database["public"]["Enums"]["booking_status"]
          ticket_code: string
          trip_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_parcel: {
        Args: {
          _declared_value: number
          _description: string
          _destination_branch: string
          _is_urgent: boolean
          _origin_branch: string
          _quantity: number
          _receiver_name: string
          _receiver_phone: string
          _route_id: string
          _sender_id: string
          _sender_name: string
          _sender_phone: string
          _trip_id?: string
          _weight: number
        }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          declared_value: number | null
          description: string
          destination_branch_id: string | null
          id: string
          is_urgent: boolean
          origin_branch_id: string | null
          payment_status: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp: string
          price: number
          quantity: number
          receiver_name: string
          receiver_phone: string
          route_id: string
          sender_id_number: string | null
          sender_name: string
          sender_phone: string
          status: Database["public"]["Enums"]["parcel_status"]
          tracking_id: string
          trip_id: string | null
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "parcels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_platform_wallet: {
        Args: {
          _company_id: string
          _gross: number
          _pct: number
          _source_id: string
          _source_type: string
        }
        Returns: undefined
      }
      expire_seat_locks: { Args: never; Returns: number }
      generate_parcel_tracking_id: { Args: never; Returns: string }
      get_company_mpesa_status: { Args: { _company_id: string }; Returns: Json }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_staff: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      lock_seats: {
        Args: {
          _seat_ids: string[]
          _session_token: string
          _trip_id: string
          _ttl_minutes?: number
        }
        Returns: {
          lock_expires_at: string
          lock_id: string
          seat_id: string
        }[]
      }
      log_admin_action: {
        Args: {
          _action: string
          _company_id?: string
          _entity: string
          _entity_id: string
          _meta?: Json
        }
        Returns: undefined
      }
      mark_parcel_paid: {
        Args: { _mpesa_code: string; _parcel_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          declared_value: number | null
          description: string
          destination_branch_id: string | null
          id: string
          is_urgent: boolean
          origin_branch_id: string | null
          payment_status: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp: string
          price: number
          quantity: number
          receiver_name: string
          receiver_phone: string
          route_id: string
          sender_id_number: string | null
          sender_name: string
          sender_phone: string
          status: Database["public"]["Enums"]["parcel_status"]
          tracking_id: string
          trip_id: string | null
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "parcels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_seat_lock: {
        Args: { _seat_id: string; _session_token: string; _trip_id: string }
        Returns: undefined
      }
      track_parcel: { Args: { _tracking_id: string }; Returns: Json }
      update_parcel_status: {
        Args: {
          _location?: string
          _new_status: Database["public"]["Enums"]["parcel_status"]
          _note?: string
          _parcel_id: string
        }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          declared_value: number | null
          description: string
          destination_branch_id: string | null
          id: string
          is_urgent: boolean
          origin_branch_id: string | null
          payment_status: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp: string
          price: number
          quantity: number
          receiver_name: string
          receiver_phone: string
          route_id: string
          sender_id_number: string | null
          sender_name: string
          sender_phone: string
          status: Database["public"]["Enums"]["parcel_status"]
          tracking_id: string
          trip_id: string | null
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "parcels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_parcel_pickup: {
        Args: { _otp: string; _parcel_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          declared_value: number | null
          description: string
          destination_branch_id: string | null
          id: string
          is_urgent: boolean
          origin_branch_id: string | null
          payment_status: Database["public"]["Enums"]["parcel_payment_status"]
          pickup_otp: string
          price: number
          quantity: number
          receiver_name: string
          receiver_phone: string
          route_id: string
          sender_id_number: string | null
          sender_name: string
          sender_phone: string
          status: Database["public"]["Enums"]["parcel_status"]
          tracking_id: string
          trip_id: string | null
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "parcels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "cashier"
        | "parcel_clerk"
        | "driver"
        | "conductor"
        | "customer"
      booking_status: "pending" | "paid" | "cancelled" | "refunded"
      bus_type: "vip" | "normal"
      discount_type: "percent" | "fixed"
      parcel_payment_status: "pending" | "paid" | "failed" | "refunded"
      parcel_status:
        | "created"
        | "paid"
        | "dispatched"
        | "in_transit"
        | "arrived"
        | "ready_for_pickup"
        | "delivered"
        | "cancelled"
      seat_class: "economy" | "business" | "vip"
      trip_status: "scheduled" | "departed" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "company_admin",
        "cashier",
        "parcel_clerk",
        "driver",
        "conductor",
        "customer",
      ],
      booking_status: ["pending", "paid", "cancelled", "refunded"],
      bus_type: ["vip", "normal"],
      discount_type: ["percent", "fixed"],
      parcel_payment_status: ["pending", "paid", "failed", "refunded"],
      parcel_status: [
        "created",
        "paid",
        "dispatched",
        "in_transit",
        "arrived",
        "ready_for_pickup",
        "delivered",
        "cancelled",
      ],
      seat_class: ["economy", "business", "vip"],
      trip_status: ["scheduled", "departed", "completed", "cancelled"],
    },
  },
} as const
