<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>INSEC - Espace Admin</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <style>
        body { background-color: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .sidebar { background-color: #ffffff; min-height: 100vh; border-right: 1px solid #eaeaea; padding: 20px; }
        .brand-title { font-weight: 800; color: #1E2761; font-size: 20px; }
        .brand-subtitle { font-size: 12px; color: #6c757d; margin-bottom: 30px; }
        .nav-link-custom { display: flex; align-items: center; padding: 12px 15px; border-radius: 10px; color: #495057; text-decoration: none; font-weight: 500; margin-bottom: 5px; }
        .nav-link-custom.active, .nav-link-custom:hover { background-color: #1E2761; color: #ffffff; }
        .nav-link-custom i { margin-right: 12px; font-size: 18px; }
        .main-content { padding: 30px; }
        .card-metric { border: none; border-radius: 15px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); background: #ffffff; height: 100%; }
        .card-metric .icon-box { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; background: #eef2f7; color: #1E2761; }
        .metric-value { font-size: 24px; font-weight: 700; color: #1E2761; margin-bottom: 2px; }
        .metric-label { font-size: 13px; color: #6c757d; }
        .chart-card { background: #ffffff; border: none; border-radius: 15px; padding: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); height: 100%; }
    </style>
</head>
<body>

    <div class="container-fluid">
        <div class="row">
            <!-- Sidebar -->
            <div class="col-md-3 col-lg-2 sidebar d-none d-md-block">
                <div class="px-2">
                    <div class="brand-title">INSEC</div>
                    <div class="brand-subtitle">Espace admin</div>
                </div>
                <nav>
                    <a href="#" class="nav-link-custom active"><i class="fa-solid fa-table-cells-large"></i> Tableau de bord</a>
                    <a href="#" class="nav-link-custom"><i class="fa-solid fa-users"></i> Étudiants</a>
                    <a href="#" class="nav-link-custom"><i class="fa-solid fa-wallet"></i> Finances</a>
                </nav>
            </div>

            <!-- Main Content Area -->
            <div class="col-md-9 col-lg-10 main-content">
                <!-- Top Bar -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h4 class="fw-bold text-dark mb-0">Bonjour, Administrateur</h4>
                    <div class="dropdown">
                        <button class="btn btn-light border rounded-pill px-3 py-2 dropdown-toggle d-flex align-items-center" type="button" data-bs-toggle="dropdown">
                            <span class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center me-2" style="width: 30px; height: 30px; font-size: 12px;">A</span>
                            <span class="fw-semibold text-secondary" style="font-size: 14px;">Administrateur</span>
                        </button>
                    </div>
                </div>

                <!-- Metrics Row -->
                <div class="row g-3 mb-4">
                    <div class="col-xl-2 col-md-4 col-sm-6">
                        <div class="card-metric">
                            <div class="icon-box"><i class="fa-solid fa-users"></i></div>
                            <div class="metric-value">312</div>
                            <div class="metric-label">Étudiants total</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-sm-6">
                        <div class="card-metric">
                            <div class="icon-box"><i class="fa-solid fa-check"></i></div>
                            <div class="metric-value">268</div>
                            <div class="metric-label">Étudiants actifs</div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-md-4 col-sm-6">
                        <div class="card-metric">
                            <div class="icon-box"><i class="fa-solid fa-wallet"></i></div>
                            <div class="metric-value">18,4M</div>
                            <div class="metric-label">Encaissés (MRU)</div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-md-4 col-sm-6">
                        <div class="card-metric">
                            <div class="icon-box"><i class="fa-solid fa-clock"></i></div>
                            <div class="metric-value">3,1M</div>
                            <div class="metric-label">En attente (MRU)</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-sm-6">
                        <div class="card-metric">
                            <div class="icon-box"><i class="fa-solid fa-chalkboard-user"></i></div>
                            <div class="metric-value">24</div>
                            <div class="metric-label">Enseignants</div>
                        </div>
                    </div>
                </div>

                <!-- Charts Row -->
                <div class="row g-3">
                    <div class="col-lg-8">
                        <div class="chart-card">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="fw-bold text-secondary mb-0">Paiements encaissés par mois</h6>
                                <div class="btn-group btn-group-sm" role="group">
                                    <button type="button" class="btn btn-dark active">7 mois</button>
                                    <button type="button" class="btn btn-outline-secondary">12 mois</button>
                                </div>
                            </div>
                            <div style="height: 220px; display: flex; align-items: flex-end; justify-content: space-around; padding-top: 20px;">
                                <div class="bg-primary rounded-top" style="width: 35px; height: 40%;"></div>
                                <div class="bg-primary rounded-top" style="width: 35px; height: 65%;"></div>
                                <div class="bg-primary rounded-top" style="width: 35px; height: 55%;"></div>
                                <div class="bg-primary rounded-top" style="width: 35px; height: 75%;"></div>
                                <div class="bg-primary rounded-top" style="width: 35px; height: 60%;"></div>
                                <div class="bg-primary rounded-top" style="width: 35px; height: 85%;"></div>
                                <div class="bg-primary rounded-top" style="width: 35px; height: 70%;"></div>
                            </div>
                            <div class="d-flex justify-content-around text-muted mt-2" style="font-size: 12px;">
                                <span>Fév</span><span>Mar</span><span>Avr</span><span>Mai</span><span>Jun</span><span>Jul</span><span>Aoû</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="chart-card text-center">
                            <h6 class="fw-bold text-secondary mb-3 text-start">Répartition des statuts</h6>
                            <div class="d-inline-flex justify-content-center align-items-center position-relative my-2" style="width: 150px; height: 150px; border: 15px solid #28a745; border-radius: 50%; border-top-color: #ffc107; border-right-color: #dc3545;">
                            </div>
                            <div class="d-flex justify-content-center gap-3 mt-3" style="font-size: 11px; font-weight: 600;">
                                <span class="text-success">● Actif</span>
                                <span class="text-warning">● Suspendu</span>
                                <span class="text-danger">● Abandon</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>