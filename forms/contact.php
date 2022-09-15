<?php
  /**
  * Requires the "PHP Email Form" library
  * The "PHP Email Form" library is available only in the pro version of the template
  * The library should be uploaded to: vendor/php-email-form/php-email-form.php
  * For more info and help: https://bootstrapmade.com/php-email-form/
  */

  // Replace contact@example.com with your real receiving email address
  if (isset($_POST[' submit'])) {
    $name = $_POST[ 'name'];
    $subject = $_POST ['subject'];
    $mailFrom = $_POST['mail'];
    $message = $_POST['message'];
    $mailto = "boualmahamzaa@gmail.com";
    $headers = "From: ". $mailFrom;
    $txt = "You have received an e-mail from ".$name.". In\n".$message;
    mail($mailTo, $subject, $txt, $headers) ;
    header ("Location: index.php?mailsend");
  }
?>