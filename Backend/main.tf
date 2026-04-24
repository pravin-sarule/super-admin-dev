output "greetings" {
    value ="Hello terraform"
}
variable "DB_NAME" {
    type = string 
    default ="citation_db"
    description = "Database name"
    
}

output "new"{
    value ="hello ${var.DB_NAME}"
}

variable "n"{
    type=number
    default=5

}
variable "m"{
    type=number
    default=55

}
output "sum"{
    value =var.n+var.m
}
