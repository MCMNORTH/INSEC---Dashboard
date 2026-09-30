<template>
    <div class="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div class="max-w-lg rounded-2xl bg-white p-10 text-center shadow">
            <p class="text-5xl font-extrabold text-insec">404</p>
            <h1 class="mt-3 text-xl font-bold text-insec">Page introuvable</h1>
            <p class="mt-2 text-gray-500">La page demandée n’existe pas ou a été déplacée.</p>
            <RouterLink to="/tableau-de-bord" class="bouton-principal mt-6">Retour au tableau de bord</RouterLink>
        </div>
    </div>
</template>
