import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { UserMediaItem } from '../../models/project.model';

@Component({
  selector: 'app-media-library',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-library.component.html',
  styleUrls: ['./media-library.component.scss']
})
export class MediaLibraryComponent implements OnInit {
  userMediaItems: UserMediaItem[] = [];
  loadingMedia = false;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  itemsPerPageOptions = [5, 10, 25, 50];

  uploading = false;
  error = "";
  successMessage = "";
  
  selectedFiles: File[] = [];
  dragActive = false;
  userEmail: string | null = null;

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUserEmail();
    this.loadUserMedia();
  }

  loadUserEmail() {
    this.authService.currentUser$.subscribe(user => {
      this.userEmail = user?.email || null;
    });
  }

  loadUserMedia() {
    this.loadingMedia = true;
    this.projectService.getUserMediaItems().subscribe({
      next: (items) => {
        this.userMediaItems = items;
        this.currentPage = 1; // Reset to first page on reload
        this.loadingMedia = false;
      },
      error: (err) => {
        console.error("Failed to load user media", err);
        this.error = "Failed to load media items.";
        this.loadingMedia = false;
      }
    });
  }

  get paginatedMediaItems(): UserMediaItem[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.userMediaItems.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.userMediaItems.length / this.itemsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onItemsPerPageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = Number(target.value);
    this.currentPage = 1;
  }

  back() {
    this.router.navigate(['/dashboard']);
  }

  showSuccess(msg: string) {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = "", 3000);
  }

  showError(err: any) {
    this.error = err?.error?.message || err?.message || "An error occurred";
    setTimeout(() => this.error = "", 5000);
  }

  // File Upload Logic
  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files) {
      this.selectedFiles = [...this.selectedFiles, ...Array.from(files)];
    }
    // Reset input
    target.value = '';
  }

  async uploadMedia(event?: Event) {
    if (event) event.preventDefault();
    if (this.selectedFiles.length === 0) {
      this.error = "Please select at least one file.";
      return;
    }
    this.uploading = true;
    this.error = "";
    this.successMessage = "";
    
    try {
      await this.projectService.uploadMediaFiles(this.selectedFiles).toPromise();
      this.showSuccess("Files uploaded successfully");
      this.selectedFiles = [];
      this.loadUserMedia();
    } catch (e: any) {
      this.showError(e);
    } finally {
      this.uploading = false;
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragActive = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragActive = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragActive = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFiles = [...this.selectedFiles, ...Array.from(files)];
    }
  }

  openFileDialog() {
    const input = document.getElementById("file-input") as HTMLInputElement | null;
    if (input) input.click();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  clearFiles() {
    this.selectedFiles = [];
  }

  // Placeholder for delete functionality (if backend supports it)
  /*
  deleteMediaItem(item: UserMediaItem) {
    if(!confirm('Are you sure?')) return;
    // this.projectService.deleteMediaItem(item.id).subscribe(...)
  }
  */
}
