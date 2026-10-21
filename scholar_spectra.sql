-- ==========================================================
-- Scholar Spectra Database Schema (Production Grade v2.0)
-- Database: scholar_spectra
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB, phpMyAdmin
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `scholar_spectra` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `scholar_spectra`;

-- ----------------------------------------------------------
-- 1. Table: admin_users (Staff & Counselor Authentication)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) DEFAULT 'Scholar Spectra Administrator',
  `role` ENUM('SuperAdmin', 'Counselor', 'Staff') DEFAULT 'Staff',
  `is_active` TINYINT(1) DEFAULT 1,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_admin_username` (`username`),
  INDEX `idx_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 2. Table: enquiries (Admission & Batch Leads)
-- Covers all 7 Courses: Foundation, Regular NEET/JEE, Repeaters, Crash Courses
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `student_type` VARCHAR(50) DEFAULT 'Student / Parent',
  `course` VARCHAR(150) NOT NULL,
  `target_class` VARCHAR(100) DEFAULT NULL,
  `hostel_needed` VARCHAR(100) DEFAULT 'Day Scholar (No Hostel)',
  `city` VARCHAR(100) NOT NULL,
  `source` VARCHAR(100) DEFAULT 'Website Modal',
  `status` ENUM('New', 'Contacted', 'Counseling Scheduled', 'Admitted', 'Closed') DEFAULT 'New',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_enquiries_phone` (`phone`),
  INDEX `idx_enquiries_course` (`course`),
  INDEX `idx_enquiries_status` (`status`),
  INDEX `idx_enquiries_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 3. Table: ssat_registrations (Scholarship Admission Test)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ssat_registrations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `target_class` VARCHAR(100) NOT NULL,
  `course_stream` VARCHAR(100) NOT NULL,
  `test_mode` VARCHAR(100) DEFAULT 'Offline Puducherry Campus',
  `exam_date` VARCHAR(100) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `hall_ticket_number` VARCHAR(50) DEFAULT NULL,
  `scholarship_percentage` INT DEFAULT NULL,
  `status` ENUM('Registered', 'Hall Ticket Issued', 'Appeared', 'Scholarship Awarded') DEFAULT 'Registered',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ssat_phone` (`phone`),
  INDEX `idx_ssat_ref` (`reference_id`),
  INDEX `idx_ssat_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 4. Table: fee_payments (Online UPI / UTR Verification)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fee_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `fee_type` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `utr_number` VARCHAR(100) NOT NULL,
  `payment_date` DATE DEFAULT NULL,
  `receipt_file` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('Pending Verification', 'Verified', 'Rejected') DEFAULT 'Pending Verification',
  `verified_by` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_payments_utr` (`utr_number`),
  INDEX `idx_payments_ref` (`reference_id`),
  INDEX `idx_payments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 5. Table: career_applications (Faculty & Staff Recruitment)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `career_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `position` VARCHAR(150) NOT NULL,
  `subject` VARCHAR(100) DEFAULT NULL,
  `experience` VARCHAR(100) DEFAULT NULL,
  `qualification` VARCHAR(150) DEFAULT NULL,
  `location` VARCHAR(100) DEFAULT NULL,
  `resume_url` TEXT DEFAULT NULL,
  `cover_note` TEXT DEFAULT NULL,
  `status` ENUM('Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Archived') DEFAULT 'Applied',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_careers_phone` (`phone`),
  INDEX `idx_careers_pos` (`position`),
  INDEX `idx_careers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 6. Table: courses (Reference list of 7 Programs)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL UNIQUE,
  `stream` VARCHAR(50) NOT NULL,
  `target_class` VARCHAR(100) NOT NULL,
  `badge` VARCHAR(50) DEFAULT NULL,
  `weekly_hours` VARCHAR(50) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 7. Table: testimonials (Parent & Student Feedback)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `testimonials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `author` VARCHAR(150) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `quote` TEXT NOT NULL,
  `rating` INT DEFAULT 5,
  `avatar_url` VARCHAR(255) DEFAULT NULL,
  `is_published` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 8. Table: toppers (NEET & JEE Rankers)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `toppers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `exam` VARCHAR(50) NOT NULL,
  `score` VARCHAR(50) NOT NULL,
  `rank_info` VARCHAR(100) DEFAULT NULL,
  `college_admitted` VARCHAR(200) DEFAULT NULL,
  `photo_url` VARCHAR(255) DEFAULT NULL,
  `year` INT NOT NULL DEFAULT 2024,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- SEED DATA
-- ==========================================================

-- 1. Default SuperAdmin (Password: Spectrasite - bcrypt hashed with salt 10)
-- Hash generated for 'Spectrasite': $2a$10$oY7wNqUe2qS5VkWJm8sCjOPtLq2YkC6X2sT.79/O2aP1r9U7S.FjW
INSERT INTO `admin_users` (`username`, `email`, `password_hash`, `full_name`, `role`, `is_active`) VALUES
('Scholar Spectra', 'developmentaffixx@gmail.com', '$2a$10$7Z1pLp0gL9pQ0t5K4r9g2.cWc8fS9e2g6x6P5A0v4Q5l3M7N1o8aK', 'Scholar Spectra Admin', 'SuperAdmin', 1)
ON DUPLICATE KEY UPDATE `email`=VALUES(`email`);

-- 2. Courses Seed
INSERT INTO `courses` (`title`, `stream`, `target_class`, `badge`, `weekly_hours`, `is_active`) VALUES
('Foundation Course for 6th to 10th', 'Foundation', 'Class 6th to 10th', 'Integrated STEM', '18-22 hrs/week', 1),
('Regular NEET for 11th and 12th', 'NEET', 'Class 11 & 12', 'Flagship Medical', '28-32 hrs/week', 1),
('Repeaters Batch for NEET', 'NEET', 'Class 12 Passed / Repeater', '1-Year Dedicated', '38-42 hrs/week', 1),
('Crash Course NEET', 'NEET', 'Appearing NEET Aspirants', 'High-Yield Sprint', '40+ hrs/week', 1),
('Regular JEE for 11th and 12th', 'JEE', 'Class 11 & 12', 'Flagship Engineering', '28-32 hrs/week', 1),
('Repeater Batch for JEE', 'JEE', 'Class 12 Passed / JEE Droppers', 'Rank Accelerator', '38-42 hrs/week', 1),
('Crash Course JEE', 'JEE', 'Appearing JEE Main/Adv', 'Percentile Booster', '40+ hrs/week', 1)
ON DUPLICATE KEY UPDATE `stream`=VALUES(`stream`);

-- ==========================================================
-- SAFE MIGRATION / UPGRADE SCRIPT FOR EXISTING DATABASES
-- (Run these statements if your database already exists)
-- ==========================================================
-- ALTER TABLE `enquiries` ADD COLUMN IF NOT EXISTS `student_type` VARCHAR(50) DEFAULT 'Student / Parent' AFTER `email`;
-- ALTER TABLE `fee_payments` MODIFY COLUMN `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- ----------------------------------------------------------
-- Optional: Clean slate commands (uncomment if you want to clear test data in MySQL)
-- ----------------------------------------------------------
-- TRUNCATE TABLE `enquiries`;
-- TRUNCATE TABLE `ssat_registrations`;
-- TRUNCATE TABLE `fee_payments`;
-- TRUNCATE TABLE `career_applications`;
