CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'recruiter',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE recruitment_stages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) UNIQUE NOT NULL,
  order_index INT NOT NULL
);

CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  linkedin_url TEXT,
  github_url TEXT,
  current_company VARCHAR(150),
  current_role VARCHAR(150),
  skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years INT NOT NULL DEFAULT 0,
  education TEXT,
  location VARCHAR(150),
  resume_url TEXT,
  stage_id INT NOT NULL REFERENCES recruitment_stages(id),
  summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_skills ON candidates USING GIN (skills);
CREATE INDEX idx_candidates_experience_years ON candidates (experience_years);
CREATE INDEX idx_candidates_location ON candidates (location);

CREATE TABLE candidate_notes (
  id SERIAL PRIMARY KEY,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  metadata JSONB,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  candidate_id INT REFERENCES candidates(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO recruitment_stages(name, order_index)
VALUES
  ('Applied', 1),
  ('Screening', 2),
  ('Interview', 3),
  ('Offer', 4),
  ('Hired', 5),
  ('Rejected', 6);
