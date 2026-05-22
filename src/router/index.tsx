import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '../components/common/AppLayout'
import HomePage from '../pages/HomePage'
import LoadCompanyPage from '../pages/LoadCompanyPage'
import CreateCompanyPage from '../pages/CreateCompanyPage'
import CompanyDetailsPage from '../pages/CompanyDetailsPage'
import EditStatsPage from '../pages/EditStatsPage'
import MatchSetupPage from '../pages/MatchSetupPage'
import ToolkitAssignmentPage from '../pages/ToolkitAssignmentPage'
import WandererSelectionPage from '../pages/WandererSelectionPage'
import MatchTrackingPage from '../pages/MatchTrackingPage'
import PostMatchSummaryPage from '../pages/PostMatchSummaryPage'
import NotFoundPage from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'companies', element: <LoadCompanyPage /> },
      { path: 'companies/new', element: <CreateCompanyPage /> },
      { path: 'companies/:companyId', element: <CompanyDetailsPage /> },
      { path: 'companies/:companyId/match/setup', element: <MatchSetupPage /> },
      {
        path: 'companies/:companyId/match/toolkit',
        element: <ToolkitAssignmentPage />,
      },
      {
        path: 'companies/:companyId/match/wanderer',
        element: <WandererSelectionPage />,
      },
      { path: 'companies/:companyId/match', element: <MatchTrackingPage /> },
      {
        path: 'companies/:companyId/post-match',
        element: <PostMatchSummaryPage />,
      },
      { path: 'stats', element: <EditStatsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
