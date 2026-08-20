from apps.automation.models import AutomationExecution
from apps.automation.tasks import execute_workflow

exec = AutomationExecution.objects.last()
print("Executing workflow...")
completed = execute_workflow(str(exec.id))
exec.refresh_from_db()
print(f'Status: {exec.status}, Error: {exec.error_message}')
for log in exec.logs.all():
    print(f'{log.node.get("action_name")} - {log.status} - {log.message}')
