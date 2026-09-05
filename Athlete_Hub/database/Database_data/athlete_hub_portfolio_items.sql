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
-- Table structure for table `portfolio_items`
--

DROP TABLE IF EXISTS `portfolio_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portfolio_items` (
  `portfolio_item_id` int NOT NULL AUTO_INCREMENT,
  `athlete_id` int NOT NULL,
  `achievement_id` int DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `display_order` int DEFAULT '0',
  `is_visible` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`portfolio_item_id`),
  KEY `fk_portfolio_athlete` (`athlete_id`),
  KEY `fk_portfolio_achievement` (`achievement_id`),
  CONSTRAINT `fk_portfolio_achievement` FOREIGN KEY (`achievement_id`) REFERENCES `achievements` (`achievement_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_portfolio_athlete` FOREIGN KEY (`athlete_id`) REFERENCES `athlete_profiles` (`athlete_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `portfolio_items`
--

LOCK TABLES `portfolio_items` WRITE;
/*!40000 ALTER TABLE `portfolio_items` DISABLE KEYS */;
INSERT INTO `portfolio_items` VALUES (1,1,NULL,'Regional Championship Portfolio Entry','A portfolio entry linked to an athletic achievement.',1,1,'2026-08-20 21:58:02'),(2,1,NULL,'Regional Championship Portfolio Entry','A portfolio entry linked to an athletic achievement.',1,1,'2026-08-20 21:58:14'),(3,1,NULL,'Regional Championship Portfolio Entry','A portfolio entry linked to an athletic achievement.',1,1,'2026-08-20 21:59:09'),(4,1,NULL,'Regional Championship Portfolio Entry','A portfolio entry linked to an athletic achievement.',1,1,'2026-08-20 22:52:49');
/*!40000 ALTER TABLE `portfolio_items` ENABLE KEYS */;
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
