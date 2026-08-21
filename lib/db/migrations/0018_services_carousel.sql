-- Add services screen carousel placement (max 3 live ads enforced in API).
ALTER TYPE "public"."ad_placement" ADD VALUE IF NOT EXISTS 'services_carousel';
