export interface Survey {
  id: number;
  title: string;
  description: string;
  status: string;
  unique_token: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  require_registration: boolean;
  registration_message: string;
  registration_start_date: string | null;
  registration_deadline: string | null;
  registration_fields?: { name: string; required: boolean }[];
  linked_voting_survey_id: number | null;
  vote_mail_body?: string | null;
  reminder_mail_body?: string | null;
  registration_mail_body?: string | null;
  questions: Question[];
}

export interface Question {
  id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text' | 'email';
  order: number;
  is_required: boolean;
  options?: Option[];
}

export interface Option {
  id: number;
  option_text: string;
  order: number;
}

export interface VoterRow {
  id: number;
  email: string;
  status: string;
  registered_at: string | null;
  link_sent_at: string | null;
  voted_at: string | null;
  reminder_sent_at: string | null;
  registration_data: Record<string, string> | null;
  surveyTitle: string;
  surveyId: number;
}

export interface VoterSummary {
  total: number;
  registered: number;
  sent: number;
  voted: number;
  expired: number;
}

export interface SurveyListItem {
  id: number;
  title: string;
  status: string;
  unique_token: string;
  created_at: string;
  linked_voting_survey_id: number | null;
}
