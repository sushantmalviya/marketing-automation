from apps.automation.models import AutomationExecution
exec = AutomationExecution.objects.last()
print(f'Status: {exec.status}, Error: {exec.error_message}')
for log in exec.logs.all():
    print(f'{log.node.get("action_name")} - {log.status} - {log.message}')
