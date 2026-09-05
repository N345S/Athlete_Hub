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
-- Table structure for table `eligibility_records`
--

DROP TABLE IF EXISTS `eligibility_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eligibility_records` (
  `eligibility_id` int NOT NULL AUTO_INCREMENT,
  `athlete_id` int NOT NULL,
  `term_id` int NOT NULL,
  `academic_status` enum('ELIGIBLE','AT_RISK','INELIGIBLE','PENDING') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `evaluated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`eligibility_id`),
  UNIQUE KEY `athlete_id` (`athlete_id`,`term_id`),
  KEY `fk_eligibility_term` (`term_id`),
  CONSTRAINT `fk_eligibility_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles` (`athlete_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eligibility_term` FOREIGN KEY (`term_id`) REFERENCES `academic_terms` (`term_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `eligibility_records`
--

LOCK TABLES `eligibility_records` WRITE;
/*!40000 ALTER TABLE `eligibility_records` DISABLE KEYS */;
INSERT INTO `eligibility_records` VALUES (1,1,1,'ELIGIBLE','Approved for current term','2026-09-02 17:10:21');
/*!40000 ALTER TABLE `eligibility_records` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-05 14:25:51
