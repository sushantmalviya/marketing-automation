from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {

    "resume-workflows": {

        "task":
            "apps.automation.tasks_resume.resume_workflows",

        "schedule": 60,

    },
    "poll-bounces-and-replies": {
        "task": "apps.communications.tasks.poll_inbox_task",
        "schedule": 300, # Every 5 minutes
    }
}