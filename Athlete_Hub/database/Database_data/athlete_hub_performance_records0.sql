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
-- Table structure for table `performance_records`
--

DROP TABLE IF EXISTS `performance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance_records` (
  `performance_record_id` int NOT NULL AUTO_INCREMENT,
  `athlete_id` int NOT NULL,
  `metric_id` int NOT NULL,
  `recorded_value` decimal(10,2) NOT NULL,
  `recorded_date` date NOT NULL,
  `coach_id` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`performance_record_id`),
  KEY `fk_performance_athlete` (`athlete_id`),
  KEY `fk_performance_metric` (`metric_id`),
  KEY `fk_performance_coach` (`coach_id`),
  CONSTRAINT `fk_performance_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles` (`athlete_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_performance_coach` FOREIGN KEY (`coach_id`) REFERENCES `coach_profiles` (`coach_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_performance_metric` FOREIGN KEY (`metric_id`) REFERENCES `performance_metric_definitions` (`metric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `performance_records`
--

LOCK TABLES `performance_records` WRITE;
/*!40000 ALTER TABLE `performance_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `performance_records` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-03  0:48:07
