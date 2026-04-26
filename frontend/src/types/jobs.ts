export interface ProjectFilament {
  index: number;
  color: string;
  type: string;
  filament_id: string | null;
}

export interface PlateInfo {
  index: number;
  gcode_path: string;
  has_thumbnail: boolean;
  filaments: number[];
  estimated_seconds: number | null;
  weight_grams: number | null;
}

export interface ProjectSettings {
  bed_type: string | null;
  nozzle_diameter: number | null;
  layer_height: number | null;
  sparse_infill_density: string | null;
  enable_prime_tower: boolean | null;
  enable_support: boolean | null;
  support_type: string | null;
  printer_model: string | null;
}

export interface ProjectMetadata {
  plates: PlateInfo[];
  filaments: ProjectFilament[];
  settings: ProjectSettings;
}

export interface JobSummary {
  id: number;
  created_at: string;
  original_filename: string;
  size_bytes: number;
  status: "uploaded" | "sent" | "failed" | "expired";
  plate_count: number;
  print_id: number | null;
}

export interface JobDetail extends JobSummary {
  metadata: ProjectMetadata;
}

export interface SendJobBody {
  plate: number;
  ams_mapping: number[];
  use_ams: boolean;
  bed_leveling: boolean;
  flow_cali: boolean;
  vibration_cali: boolean;
  layer_inspect: boolean;
  timelapse: boolean;
}

export interface SendJobResult {
  ok: boolean;
  detail: string;
  remote_path: string | null;
}
