import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '../components/common/AppLayout'
import HomePage from '../pages/HomePage'
import LoadCompanyPage from '../pages/LoadCompanyPage'
import CreateCompanyPage from '../pages/CreateCompanyPage'
import CompanyDetailsPage from '../pages/CompanyDetailsPage'
import EditStatsPage from '../pages/EditStatsPage'
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
      { path: 'stats', element: <EditStatsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
