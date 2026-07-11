from django.db import models

# Create your models here.
class GeneralUser(models.Model):
    email = models.EmailField()
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    created = models.DateTimeField()

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

class Transaction(models.Model):
    user = models.ForeignKey(GeneralUser, on_delete=models.CASCADE, related_name='csv_rows')

    #uuid = models.UUIDField()
    ticker = models.CharField(max_length=7)
    value = models.IntegerField()