<div id="confirm-delete-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40">
    <div class="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 border-t-4 border-red-500">
        <div class="flex items-center gap-3 mb-3">
            <span class="text-2xl">⚠️</span>
            <h2 class="text-lg font-bold text-red-600">Confirmer la suppression</h2>
        </div>
        <p id="confirm-delete-message" class="text-sm text-gray-600 mb-6">
            Cette action est irréversible.
        </p>
        <form id="confirm-delete-form" method="POST">
            @csrf
            @method('DELETE')
            <div class="flex justify-end gap-3">
                <button type="button" onclick="closeDeleteModal()" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
                    Annuler
                </button>
                <button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                    Supprimer
                </button>
            </div>
        </form>
    </div>
</div>

<script>
    function openDeleteModal(actionUrl, label) {
        document.getElementById('confirm-delete-form').setAttribute('action', actionUrl);
        document.getElementById('confirm-delete-message').textContent =
            'Voulez-vous vraiment supprimer ' + label + ' ? Cette action est irréversible.';
        document.getElementById('confirm-delete-modal').classList.remove('hidden');
        document.getElementById('confirm-delete-modal').classList.add('flex');
    }
    function closeDeleteModal() {
        document.getElementById('confirm-delete-modal').classList.add('hidden');
        document.getElementById('confirm-delete-modal').classList.remove('flex');
    }
</script>