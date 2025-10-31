// Types de base pour l'application PronoHub

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: Date;
}

export interface Tournament {
  id: string;
  name: string;
  competition_id: number; // ID de la compétition de football-data API
  competition_name: string; // Ex: "Ligue 1", "Champions League"
  creator_id: string;
  max_participants: number;
  current_participants: number;
  matchdays_count: number; // Nombre de journées
  invite_code: string; // Code unique pour rejoindre
  qr_code?: string; // QR code généré
  status: 'pending' | 'active' | 'completed';
  scoring_rules: ScoringRules;
  created_at: Date;
  start_date?: Date;
}

export interface ScoringRules {
  exact_score: number; // Points pour score exact
  correct_winner: number; // Points pour bon résultat (victoire/nul/défaite)
  correct_goal_difference: number; // Points pour bonne différence de buts
}

export interface Match {
  id: string;
  tournament_id: string;
  football_data_match_id: number; // ID du match de l'API
  home_team: string;
  away_team: string;
  matchday: number; // Numéro de journée
  scheduled_date: Date;
  actual_home_score?: number;
  actual_away_score?: number;
  status: 'scheduled' | 'in_progress' | 'finished';
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  tournament_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points_earned?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  joined_at: Date;
  total_points: number;
  rank?: number;
}

export interface Leaderboard {
  tournament_id: string;
  participants: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  user: User;
  total_points: number;
  predictions_count: number;
  exact_scores: number;
  rank: number;
}

// Types pour l'API Football-Data
export interface FootballDataCompetition {
  id: number;
  name: string;
  code: string;
  emblem?: string;
  currentSeason: {
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
}

export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: {
    id: number;
    name: string;
    crest?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    crest?: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}
