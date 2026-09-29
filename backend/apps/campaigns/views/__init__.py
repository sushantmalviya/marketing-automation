from .campaign import (
    CampaignCreateAPIView,
    CampaignDetailAPIView,
)
from .customer import (
    CustomerUploadAPIView,
    CustomerUploadListAPIView,
    CustomerUploadDetailAPIView,
    CustomerSourceDeleteAPIView,
    CustomerRecordListAPIView,
    CustomerRecordDetailAPIView,
    CustomerBulkDeleteAPIView,
    ContactHierarchyAPIView,
)
from .channel import AssignChannelsView, ChannelListAPIView

from .audience import AudiencePreviewAPIView, AudienceCreateAPIView, AudienceListAPIView, AudienceDetailAPIView, AudienceTagsAPIView

from .template import (
    TemplateCreateAPIView,
    TemplateListAPIView,
    CampaignTemplateAssignAPIView,
    TemplateUpdateAPIView,
    TemplateSubmitAPIView,
    TemplateDeleteAPIView,
)
from .preview import CampaignPreviewAPIView

from .schedule import (
    CampaignScheduleAPIView,
    CampaignScheduleUpdateAPIView
)

from .send import CampaignSendAPIView

from .analytics import CampaignAnalyticsAPIView

