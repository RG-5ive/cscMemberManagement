-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  memberLevel TEXT,
  location TEXT,
  languages TEXT[] DEFAULT '{}',
  gender TEXT,
  lgbtq2Status TEXT,
  bipocStatus TEXT,
  ethnicity TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER REFERENCES users(id),
  to_user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create survey_responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES surveys(id),
  user_id INTEGER REFERENCES users(id),
  answers JSONB NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workshops table
CREATE TABLE IF NOT EXISTS workshops (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  capacity INTEGER NOT NULL
);

-- Create workshop_registrations table
CREATE TABLE IF NOT EXISTS workshop_registrations (
  id SERIAL PRIMARY KEY,
  workshop_id INTEGER REFERENCES workshops(id),
  user_id INTEGER REFERENCES users(id),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workshop_id, user_id)
);

-- Session storage table - will be handled by memory store instead
-- CREATE TABLE IF NOT EXISTS session (
--   sid VARCHAR NOT NULL,
--   sess JSON NOT NULL,
--   expire TIMESTAMP(6) NOT NULL,
--   PRIMARY KEY (sid)
-- );