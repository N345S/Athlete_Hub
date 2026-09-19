-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: athlete_hub
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `academic_records`
--

DROP TABLE IF EXISTS `academic_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_records` (
  `academic_record_id` int NOT NULL AUTO_INCREMENT,
  `athlete_id` int NOT NULL,
  `term_id` int NOT NULL,
  `import_batch_id` int DEFAULT NULL,
  `subject_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `units` decimal(4,2) DEFAULT NULL,
  `grade` decimal(4,2) DEFAULT NULL,
  `remarks` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` enum('API','FILE_IMPORT','MANUAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FILE_IMPORT',
  `imported_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`academic_record_id`),
  KEY `fk_academic_athlete` (`athlete_id`),
  KEY `fk_academic_term` (`term_id`),
  KEY `fk_academic_import_batch` (`import_batch_id`),
  CONSTRAINT `fk_academic_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles` (`athlete_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_academic_import_batch` FOREIGN KEY (`import_batch_id`) REFERENCES `academic_import_batches` (`import_batch_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_academic_term` FOREIGN KEY (`term_id`) REFERENCES `academic_terms` (`term_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_records`
--

LOCK TABLES `academic_records` WRITE;
/*!40000 ALTER TABLE `academic_records` DISABLE KEYS */;
INSERT INTO `academic_records` VALUES (3,1,1,NULL,'DB101','Database Management',3.00,1.50,'Passed','MANUAL','2026-08-21 04:59:38'),(4,1,1,NULL,'PE101','Physical Education',2.00,1.25,'Passed','MANUAL','2026-08-21 04:59:38'),(5,1,1,NULL,'CCS101','Introduction to Computing',3.00,1.50,'Passed','MANUAL','2026-08-21 05:17:53'),(6,1,1,NULL,'WEB101','Web Development',3.00,1.75,'Passed','MANUAL','2026-08-21 05:17:53'),(7,1,1,NULL,'DB101','Database Management',3.00,1.50,'Passed','MANUAL','2026-08-21 05:17:53'),(8,1,1,NULL,'PE101','Physical Education',2.00,1.25,'Passed','MANUAL','2026-08-21 05:17:53'),(9,1,15,1,'PE101','Athletic Performance',3.00,92.50,'Evaluation sent by registrar.','API','2026-09-02 17:10:33');
/*!40000 ALTER TABLE `academic_records` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-07  8:59:03
